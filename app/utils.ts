import { JourneyContext, MutableRouter } from '@dwp/govuk-casa';
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';

export const FOUND_ADDRESSES_DATA = 'found-addresses-data';

export const setEditFlag = (req: Request, edit: boolean) => {
  const journeyContext = JourneyContext.getDefaultContext(req.session);
  journeyContext.setDataForPage('edit', { edit });
}

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
  (req as any).casa.journeyContext.setDataForPage('skippedTo', { __skipmeta__: skipto });
  (req as any).casa.journeyContext.setDataForPage('skippedFrom', { __skipmeta__: waypoint });
}

export const clearSkipMeta = (req: Request) => {
  (req as any).casa.journeyContext.setDataForPage('skippedTo', {});
  (req as any).casa.journeyContext.setDataForPage('skippedFrom', {});
}

const prependUseCallback = async (req: Request, res: Response, next: NextFunction) => {
  const waypoint = (req as any)._parsedUrl.pathname.replace('/', '');

  var toApplySkipMeta = true;

  if (req.method === 'GET') {
    const tempData = (req as any).casa.journeyContext.getDataForPage(`temp-${waypoint}`);
    const skipto = req.query.skipto;

    const data = (req as any).casa.journeyContext.getDataForPage('temp-address-confirmation');
    (req as any).casa.journeyContext.setDataForPage('address-confirmation', data);

    if (tempData !== undefined) {
      (req as any).casa.journeyContext.setDataForPage(waypoint, tempData);
    }

    if (waypoint === 'post-code') {
      if (skipto === 'address-manual') {
        const waypointsToClear = [
          'address-confirmation', 'temp-address-confirmation',
          'address-manual', 'temp-manual-confirmation'
        ];
        removeWaypointsFromJourneyContext(req, waypointsToClear);

      }
    }

    if (waypoint === 'post-code-results') {
      const { addresses } = (req as any).casa.journeyContext.getDataForPage(FOUND_ADDRESSES_DATA) as { addresses: string[] };
      const addressOptions = addresses.map(address => ({ value: address, text: address }));
      res.locals.addressOptions = addressOptions;

      if (skipto === 'address-manual') {
        const waypointsToClear = [
          'address-confirmation', 'temp-address-confirmation',
          'address-manual', 'temp-manual-confirmation',
        ];
        removeWaypointsFromJourneyContext(req, waypointsToClear);
      }

      if (skipto === 'post-code') {
        const waypointsToClear = [
          'post-code', 'temp-post-code',
          'post-code-results', 'temp-post-code-results',
          'address-confirmation', 'temp-address-confirmation',
          'address-manual', 'temp-manual-confirmation',
        ];

        removeWaypointsFromJourneyContext(req, waypointsToClear);
      }
    }

    if (waypoint === 'address-confirmation') {
      const data = (req as any).casa.journeyContext.getDataForPage('post-code-results');
      res.locals.useDifferentAddress = data?.address !== undefined;

      if (skipto === 'post-code') {
        const waypointsToClear = [
          'post-code', 'temp-post-code',
          'post-code-results', 'temp-post-code-results',
          'address-confirmation', 'temp-address-confirmation',
          'address-manual', 'temp-manual-confirmation',
        ];

        removeWaypointsFromJourneyContext(req, waypointsToClear);
      }

      if (skipto === 'post-code-results') {
        const waypointsToClear = [
          'address-confirmation', 'temp-address-confirmation',
          'address-manual', 'temp-manual-confirmation',
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

        (req as any).casa.journeyContext.setDataForPage('post-code', { __skipped__: true });
        applySkipMeta(req, 'post-code', 'address-manual');
        toApplySkipMeta = false;
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
      (req as any).casa.journeyContext.setDataForPage('route', { route: 'manual' });
    }
    if (waypoint === 'post-code') {
      try {
        const data = req.body;
        const results = await axios.post<string[]>('http://localhost:3001/address', data);
        const addresses = results.data;
        (req as any).casa.journeyContext.setDataForPage(FOUND_ADDRESSES_DATA, { addresses });
        (req as any).casa.journeyContext.setDataForPage('route', { route: 'automatic' });
      } catch (error) {
        console.log('failed to fetch data from address service');
      }
    }
    if(waypoint === 'address-confirmation') {
      removeWaypointsFromJourneyContext(req, ['route']);
    }

    if (waypoint !== 'address-confirmation') {
      const data = { ...req.body };
      delete data._csrf;
      delete data.contextid;
      (req as any).casa.journeyContext.setDataForPage(`temp-${waypoint}`, data);
    }
  }

  if (req.query.skipto && toApplySkipMeta) {
    applySkipMeta(req, waypoint, req.query.skipto as string);
  }

  JourneyContext.putContext(req.session, (req as any).casa.journeyContext);
  req.session.save(next);

  //console.log((req as any).casa.journeyContext.getData());
};

export const prepareJourneyMiddleware = (journeyRouter: MutableRouter) => {
  journeyRouter.prependUse('/post-code', prependUseCallback);
  journeyRouter.prependUse('/post-code-results', prependUseCallback);
  journeyRouter.prependUse('/address-confirmation', prependUseCallback);
  journeyRouter.prependUse('/address-manual', prependUseCallback);
  journeyRouter.prependUse('/address-not-found', prependUseCallback);
}
