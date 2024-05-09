import path from 'path';
import helmet from 'helmet';
import { Store } from 'express-session';
import { configure, JourneyContext, MutableRouter, Plan, waypointUrl } from "@dwp/govuk-casa";
import express, { NextFunction, Request, Response } from 'express';
import postCodeFields from './definitions/post-code';
import postCodeResultsFields from './definitions/post-code-results';
import addressConfirmationFields from './definitions/address-confirmation';
import addressManualFields from './definitions/address-manual';
import nameFields from './definitions/name';
import surnameFields from './definitions/surname';

const getPageData = (journeyContext: JourneyContext, waypoint: string) => {
  const pageData = journeyContext.getDataForPage(waypoint);
  return pageData;
}

const getPageOrTempDataAndSetToPage = (journeyContext: JourneyContext, waypoint: string) => {
  const pageData = getPageData(journeyContext, waypoint) ??
    getPageData(journeyContext, `temp-${waypoint}`);

  journeyContext.setDataForPage(waypoint, pageData);
}

const applyTempData = (req: Request, journeyContext: JourneyContext, waypoint: string) => {
  const tempData = getPageData(journeyContext, `temp-${waypoint}`);
  if (!req.query?.skipto) {
    journeyContext.setDataForPage(waypoint, tempData);
  }

  const skipped = (getPageData(journeyContext, waypoint) as any).__skipped__;
  if (!skipped) {
    journeyContext.setDataForPage(`temp-${waypoint}`, getPageData(journeyContext, waypoint));
  }
}

const addressApp = (
  name: string,
  secret: string,
  ttl: number,
  secure: boolean,
  sessionStore: Store,
) => {
  const casaApp = express();
  casaApp.use(helmet.noSniff());

  const viewDir = path.join(__dirname, './views/');
  const localesDir = path.join(__dirname, './locales/');

  const plan = new Plan();

  plan.addSequence('name', 'surname', 'post-code');
  plan.addSkippables('post-code', 'post-code-results', 'address-manual', 'address-confirmation', 'url:///start/');

  plan.setRoute('post-code', 'address-manual', (r, c) => c.data['post-code']?.__skipped__);
  plan.setRoute('post-code', 'post-code-results', (r, c) => !c.data['post-code']?.__skipped__);

  plan.setRoute('post-code-results', 'address-manual', (r, c) => c.data['post-code-results']?.__skipped__);
  plan.setRoute('post-code-results', 'address-confirmation', (r, c) => !c.data['post-code-results']?.__skipped__);

  plan.setRoute('address-manual', 'address-confirmation');
  plan.setRoute('address-confirmation', 'address-manual', (r, c) => c.data['address-confirmation']?.__skipped__);

  plan.setRoute('address-confirmation', 'url:///start/', (r, c) => !c.data['address-confirmation']?.__skipped__);

  const { mount, ancillaryRouter, journeyRouter } = configure({
    views: [viewDir],
    i18n: {
      dirs: [localesDir],
      locales: ['en'],
    },
    session: {
      name,
      secret,
      ttl,
      secure,
      store: sessionStore,
    },
    pages: [
      {
        waypoint: 'name',
        view: 'pages/name.njk',
        fields: nameFields
      },
      {
        waypoint: 'surname',
        view: 'pages/surname.njk',
        fields: surnameFields,
      },
      {
        waypoint: 'post-code',
        view: 'pages/post-code.njk',
        fields: postCodeFields
      },
      {
        waypoint: 'post-code-results',
        view: 'pages/post-code-results.njk',
        fields: postCodeResultsFields,
      },
      {
        waypoint: 'address-confirmation',
        view: 'pages/address-confirmation.njk',
        fields: addressConfirmationFields,
        hooks: [
          {
            hook: 'prerender',
            middleware: (req: Request, res: Response, next: NextFunction) => {
              const journeyContext = JourneyContext.getDefaultContext(req.session);
              if (req.session.previousUrl === '/address-manual') {
                const data = journeyContext.getDataForPage('address-manual') as {
                  addressLine1: string;
                  addressLine2: string;
                  town: string;
                  county: string;
                  postCode: string;
                };
                const address = `${data.addressLine1} /n ${data.postCode}`;
                journeyContext.setDataForPage('address-confirmation', { address });
                res.locals.casa.journeyPreviousUrl = '/address-manual';
              }

              if (req.session.previousUrl === '/post-code-results') {
                const data = journeyContext.getDataForPage('post-code-results') as { address: string };
                journeyContext.setDataForPage('address-confirmation', data);
                res.locals.casa.journeyPreviousUrl = '/post-code-results';
              }

              next();
            }
          }
        ]
      },
      {
        waypoint: 'address-manual',
        view: 'pages/address-manual.njk',
        fields: addressManualFields,
      }
    ],
    hooks: [
      {
        hook: "journey.prerender",
        middleware: (req: Request, res: Response, next: NextFunction) => {
          console.log('*********');
          console.log('prerender');
          console.log(req.originalUrl);
          const journeyContext = JourneyContext.getDefaultContext(req.session);

          console.log(journeyContext.getData());

          getPageOrTempDataAndSetToPage(journeyContext, 'post-code');
          getPageOrTempDataAndSetToPage(journeyContext, 'post-code-results');
          getPageOrTempDataAndSetToPage(journeyContext, 'address-confirmation');
          getPageOrTempDataAndSetToPage(journeyContext, 'address-manual');

          console.log('*********');
          next();
        }
      }
    ],
    plan
  });

  const prependUseCallback = (req: Request, res: Response, next: NextFunction) => {
    const journeyContext = JourneyContext.getDefaultContext(req.session);
    const waypoint = req.originalUrl.replace("/", "");
    
    if (req.method === 'GET') {
      const tempData = journeyContext.getDataForPage(`temp-${waypoint}`);
      const data = journeyContext.getDataForPage(waypoint) as any;

      if (data?.__skipped__ && tempData !== undefined) {
        journeyContext.setDataForPage(waypoint, tempData);
      }
    }

    if (req.method === 'POST') {
      journeyContext.setDataForPage(`temp-${waypoint}`, req.body);
    }

    JourneyContext.putContext(req.session, (req as any).casa.journeyContext);
    req.session.save(next);
  };

  const prepareJourneyMiddleware = (journeyRouter: MutableRouter) => {
    journeyRouter.prependUse('/post-code', prependUseCallback);
    journeyRouter.prependUse('/post-code-results', prependUseCallback);
    journeyRouter.prependUse('/address-confirmation', prependUseCallback);
    journeyRouter.prependUse('/address-manual', prependUseCallback);
    
  }

  prepareJourneyMiddleware(journeyRouter);

  ancillaryRouter.use('/start', (req: Request, res: Response) => {
    res.render('pages/start.njk');
  });

  return mount(casaApp, {});
}

export default addressApp;
