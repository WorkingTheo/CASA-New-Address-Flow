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
import axios from 'axios';

const FOUND_ADDRESSES_DATA = 'found-addresses-data';

export const removeWaypointsFromJourneyContext = (req: Request, waypoints: string[], includeTempData?: boolean) => {
  const allData = (req as any).casa.journeyContext.getData();
  const allWaypoints = Object.keys(allData);
  const removedData = allWaypoints.reduce((acc, waypoint) => {
    const removeTempWaypoint = waypoints.includes(waypoint.replace('temp-', '')) && includeTempData;
    if (waypoints.includes(waypoint) || removeTempWaypoint) {
      return acc;
    }
    return { ...acc, [waypoint]: allData[waypoint] };
  }, {});
  (req as any).casa.journeyContext.setData(removedData);
};

export const applySkipMeta = (req: Request, waypoint: string, skipto: string) => {
  console.log({ place: 'APPLYSKIPMETA', waypoint, skipto });
  (req as any).casa.journeyContext.setDataForPage('skippedTo', { __skipmeta__: skipto });
  (req as any).casa.journeyContext.setDataForPage('skippedFrom', { __skipmeta__: waypoint });
}

export const clearSkipMeta = (req: Request) => {
  (req as any).casa.journeyContext.setDataForPage('skippedTo', {});
  (req as any).casa.journeyContext.setDataForPage('skippedFrom', {});
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

  plan.addSequence('name', 'surname');
  plan.addSkippables('post-code', 'post-code-results', 'address-not-found', 'address-manual', 'address-confirmation', 'url:///start/');

  plan.setRoute('surname', 'post-code', (r, c) => c.data['temp-address-confirmation']?.address === undefined);
  plan.setRoute('surname', 'address-confirmation', (r, c) => c.data['temp-address-confirmation']?.address !== undefined);

  plan.setRoute('post-code', 'address-manual', (r, c) =>
    c.data['post-code']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'address-manual' &&
    c.data.skippedFrom.__skipmeta__ === 'post-code'
  );
  plan.setRoute('post-code', 'post-code-results', (r, c) => !c.data['post-code']?.__skipped__ && c.data[FOUND_ADDRESSES_DATA]?.addresses.length > 0);
  plan.setRoute('post-code', 'address-not-found', (r, c) => !c.data['post-code']?.__skipped__ && c.data[FOUND_ADDRESSES_DATA]?.addresses.length === 0);

  plan.setRoute('address-not-found', 'address-manual', (r, c) =>
    c.data['address-not-found']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'address-manual' &&
    c.data.skippedFrom.__skipmeta__ === 'address-not-found'
  );
  plan.setRoute('address-not-found', 'post-code', (r, c) =>
    c.data['address-not-found']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'post-code' &&
    c.data.skippedFrom.__skipmeta__ === 'address-not-found'
  );

  plan.setRoute('post-code-results', 'address-manual', (r, c) =>
    c.data['post-code-results']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'address-manual' &&
    c.data.skippedFrom.__skipmeta__ === 'post-code-results');
  plan.setRoute('post-code-results', 'address-confirmation', (r, c) => !c.data['post-code-results']?.__skipped__);

  plan.setRoute('address-manual', 'address-confirmation', (r, c) => !c.data['address-manual']?.__skipped__);
  plan.setRoute('address-manual', 'post-code', (r, c) =>
    c.data['address-manual']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'post-code' &&
    c.data.skippedFrom.__skipmeta__ === 'address-manual'
  );

  plan.setRoute('address-confirmation', 'address-manual', (r, c) =>
    c.data['address-confirmation']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'address-manual'
    && c.data.skippedFrom.__skipmeta__ === 'address-confirmation'
  );
  plan.setRoute('address-confirmation', 'post-code', (r, c) =>
    c.data['address-confirmation']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'post-code'
    && c.data.skippedFrom.__skipmeta__ === 'address-confirmation'
  );
  plan.setRoute('address-confirmation', 'post-code-results', (r, c) =>
    c.data['address-confirmation']?.__skipped__ &&
    c.data.skippedTo.__skipmeta__ === 'post-code-results'
    && c.data.skippedFrom.__skipmeta__ === 'address-confirmation'
  );
  plan.setRoute('address-confirmation', 'url:///start/', (r, c) => c.data['address-confirmation']?.__skipped__ !== true);

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
        fields: postCodeFields,
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
              if (req.session.previousUrl === '/address-manual') {
                res.locals.casa.journeyPreviousUrl = '/address-manual';
              }

              if (req.session.previousUrl === '/post-code-results') {
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
      },
      {
        waypoint: 'address-not-found',
        view: 'pages/address-not-found.njk'
      }
    ],
    plan
  });

  const prependUseCallback = async (req: Request, res: Response, next: NextFunction) => {
    // try from request object 
    const waypoint = (req as any)._parsedUrl.pathname.replace('/', '');

    console.log({ place: 'PREPEND', waypoint });

    if (req.method === 'GET') {
      const tempData = (req as any).casa.journeyContext.getDataForPage(`temp-${waypoint}`);

      if (tempData !== undefined) {
        (req as any).casa.journeyContext.setDataForPage(waypoint, tempData);
      }

      if (waypoint === 'post-code-results') {
        const { addresses } = (req as any).casa.journeyContext.getDataForPage(FOUND_ADDRESSES_DATA) as { addresses: string[] };
        const addressOptions = addresses.map(address => ({ value: address, text: address }));
        res.locals.addressOptions = addressOptions;
      }

      if (waypoint === 'address-not-found') {
        const waypointsToClear = [
          'post-code', 'temp-post-code', 'post-code-results',
          'temp-post-code-results', 'address-confirmation', 'temp-address-confirmation'
        ];

        removeWaypointsFromJourneyContext(req, waypointsToClear);
      }

      if (waypoint === 'address-confirmation') {
        const skipto = req.query.skipto;
        if (skipto === 'post-code') {
          const waypointsToClear = [
            'post-code', 'temp-post-code', 'post-code-results',
            'temp-post-code-results', 'address-confirmation', 'temp-address-confirmation'
          ];

          removeWaypointsFromJourneyContext(req, waypointsToClear);
        }

        if (skipto === 'address-manual') {
          const waypointsToClear = [
            'post-code', 'temp-post-code', 
            'post-code-results', 'temp-post-code-results', 
            'address-manual', 'temp-address-manual',
            'address-confirmation', 'temp-address-confirmation'
          ];

          removeWaypointsFromJourneyContext(req, waypointsToClear);
        }
      }
    }

    if (req.method === 'POST') {
      if (waypoint === 'post-code-results') {
        const address = req.body.address;
        (req as any).casa.journeyContext.setDataForPage('temp-address-confirmation', { address });
      }
      if (waypoint === 'address-manual') {
        const { addressLine1, postCode } = req.body;
        const address = `${addressLine1} - ${postCode}`;
        (req as any).casa.journeyContext.setDataForPage('temp-address-confirmation', { address });
      }
      if (waypoint === 'post-code') {
        try {
          const data = req.body;
          const results = await axios.post<string[]>('http://localhost:3001/address', data);
          console.log('GOT RESULTS HERE');
          const addresses = results.data;
          console.log(addresses);
          (req as any).casa.journeyContext.setDataForPage(FOUND_ADDRESSES_DATA, { addresses });
        } catch (error) {
          console.log('failed to fetch data from address service');
        }
      }

      if (waypoint !== 'address-confirmation') {
        const data = { ...req.body };
        delete data._csrf;
        delete data.contextid;
        (req as any).casa.journeyContext.setDataForPage(`temp-${waypoint}`, data);
      }
    }

    if (req.query.skipto) {
      applySkipMeta(req, waypoint, req.query.skipto as string);
    }

    JourneyContext.putContext(req.session, (req as any).casa.journeyContext);
    req.session.save(next);

    console.log((req as any).casa.journeyContext.getData());
  };

  const prepareJourneyMiddleware = (journeyRouter: MutableRouter) => {
    journeyRouter.prependUse('/post-code', prependUseCallback);
    journeyRouter.prependUse('/post-code-results', prependUseCallback);
    journeyRouter.prependUse('/address-confirmation', prependUseCallback);
    journeyRouter.prependUse('/address-manual', prependUseCallback);
    journeyRouter.prependUse('/address-not-found', prependUseCallback);
  }

  prepareJourneyMiddleware(journeyRouter);

  ancillaryRouter.use('/start', (req: Request, res: Response) => {
    res.render('pages/start.njk');
  });

  return mount(casaApp, {});
}

export default addressApp;
