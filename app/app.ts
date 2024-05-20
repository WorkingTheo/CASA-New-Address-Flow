import path from 'path';
import helmet from 'helmet';
import { Store } from 'express-session';
import { configure } from "@dwp/govuk-casa";
import express, { Request, Response } from 'express';

import { plan } from './plan';
import { pages } from './pages';
import { prepareJourneyMiddleware } from './utils';

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
    pages,
    plan
  });

  prepareJourneyMiddleware(journeyRouter);

  ancillaryRouter.use('/start', (req: Request, res: Response) => {
    res.render('pages/start.njk');
  });

  return mount(casaApp, {});
}

export default addressApp;
