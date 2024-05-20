import { field, validators as r } from '@dwp/govuk-casa';

export default [
  field('address').validators([
    r.required.make({
      errorMsg: 'Select an address'
    }),
  ]),
];
