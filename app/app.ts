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

  plan.addSkippables('post-code', 'post-code-results', 'address-confirmation', 'address-manual');

  plan.addSequence('post-code', 'post-code-results', 'address-confirmation', 'url:///start/');

  plan.addSequence('address-manual', 'address-confirmation', 'url:///start/');

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
      {
        waypoint: 'address-confirmation',
        view: 'pages/address-confirmation.njk',
        fields: addressConfirmationFields,
        hooks: [{
          hook: 'prerender',
          middleware: (req, res, next) => {
            console.log('RAN MIDDLEWARE (address-confirmation)');
            const journeyContext = JourneyContext.getDefaultContext(req.session);
            const data = journeyContext.getDataForPage('post-code-results') as { address: string };
            journeyContext.setDataForPage('address-confirmation', data);
            console.log(`previous url was: ${req.session.previousUrl}`);
            next();
          },
        }],
      },
      {
        waypoint: 'address-manual',
        view: 'pages/address-manual.njk',
        fields: addressManualFields,
      }
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

  return mount(casaApp, {});
}

export default addressApp;
