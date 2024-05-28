import path from 'path';
import helmet from 'helmet';
import { Store } from 'express-session';
import { JourneyContext, configure } from "@dwp/govuk-casa";
import express, { Request, Response } from 'express';

import { plan } from './plan';
import { pages } from './pages';
import { prepareJourneyMiddleware, removeWaypointsFromJourneyContext } from './utils';
import { checkYourAnswers } from './check-your-answers';

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

  ancillaryRouter.use('/check-your-answers', (req: Request, res: Response) => {
    checkYourAnswers(req, res);
    res.render('pages/check-your-answers.njk');
  });

  ancillaryRouter.use('/edit-address', (req: Request, res: Response) => {
    console.log('INSIDE EDIT-ADDRESS');
    const journeyContext = JourneyContext.getDefaultContext(req.session);
    journeyContext.setDataForPage('edit', { edit: true });

    console.log('REDIRECtiNG TO POST-CODE');
    res.redirect('/address-confirmation');
  });

  return mount(casaApp, {});
}

export default addressApp;
