import { field, validators as r } from '@dwp/govuk-casa';

const regexPostcode = /^\s*[\[\{\(]*\s*([A-Za-z][A-Ha-hJ-Yj-y]?\d[A-Za-z\d]?[-\s–.—\[\{\(\)\]\}]*\d[A-Za-z]{2}|[Gg][Ii][Rr]\s*0[Aa]{2})\s*[\)\]\}]*\s*$/gm;

export default [
  field('searchString'),
  field('postcode').validators([
    r.required.make({
      errorMsg: 'Post code is required',
    }),
    r.regex.make({
      pattern: regexPostcode,
      errorMsg: 'Enter a valid post code',
    }),
  ]),
];
