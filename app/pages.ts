import { NextFunction, Request, Response } from 'express';

import nameFields from './definitions/name';
import surnameFields from './definitions/surname';
import postCodeFields from './definitions/post-code';
import addressManualFields from './definitions/address-manual';
import postCodeResultsFields from './definitions/post-code-results';
import addressConfirmationFields from './definitions/address-confirmation';

export const pages = [
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
          if((req as any).casa.journeyContext.getDataForPage('edit')?.edit === true) {
            res.locals.casa.journeyPreviousUrl = '/check-your-answers';
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
];
