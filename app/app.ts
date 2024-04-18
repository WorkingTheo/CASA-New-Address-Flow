import path from 'path';
import helmet from 'helmet';
import { Store } from 'express-session';
import { configure, JourneyContext, Plan, waypointUrl } from "@dwp/govuk-casa";
import express, { Request, Response } from 'express';
import postCodeFields from './definitions/post-code';
import postCodeResultsFields from './definitions/post-code-results';
import addressConfirmationFields from './definitions/address-confirmation';
import addressManualFields from './definitions/address-manual';

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

  plan.addSequence('post-code', 'post-code-results', 'url:///address-confirmation/');

  const { mount, ancillaryRouter } = configure({
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
        waypoint: 'post-code',
        view: 'pages/post-code.njk',
        fields: postCodeFields
      },
      {
        waypoint: 'post-code-results',
        view: 'pages/post-code-results.njk',
        fields: postCodeResultsFields,
      },
    ],
    hooks: [
      {
        hook: "journey.preredirect",
        middleware: (req: Request, res, next) => {
          req.session.previousUrl = req.originalUrl;
          console.log(req.originalUrl);
          next();
        },
      },  
    ],
    plan
  });

  ancillaryRouter.use('/start', (req: Request, res: Response) => {
    res.render('pages/start.njk');
  });

  ancillaryRouter.use('/address-confirmation', (req: Request, res: Response) => {
    const journeyContext = JourneyContext.getDefaultContext(req.session);
    if(req.session.previousUrl === '/post-code-results') {
      console.log('previous page was post-code-results');
      const address = (journeyContext.getDataForPage('post-code-results') as { address: string }).address;
      console.log(address);
      res.locals.address = address;
    } else {
      console.log('previous page was address-manual');
      const address = (journeyContext.getDataForPage('address-manual') as { address: string }).address;
      console.log(address);
      res.locals.address = address;
    }
    res.render('pages/address-confirmation.njk');
  });

  ancillaryRouter.use('/address-manual', (req: Request, res: Response) => {
    if(req.method === 'GET') {
      res.render('pages/address-manual.njk');
      return;
    }

    if(req.method === 'POST') {
      console.log(req.body);
      req.session.previousUrl = '/address-manual';
      const journeyContext = JourneyContext.getDefaultContext(req.session);
      journeyContext.setDataForPage('address-manual', { address: req.body.address });
      res.redirect('/address-confirmation');
    }
  })

  return mount(casaApp, {});
}

export default addressApp;
