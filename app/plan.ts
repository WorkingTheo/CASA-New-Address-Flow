import { Plan } from "@dwp/govuk-casa";
import { FOUND_ADDRESSES_DATA } from "./utils";

export const plan = new Plan();

plan.addSequence('name', 'surname');
plan.addSkippables('post-code', 'post-code-results', 'address-not-found', 'address-manual', 'address-confirmation', 'url:///start/');

plan.setRoute('surname', 'post-code', (r, c) => c.data['address-confirmation']?.address === undefined);
plan.setRoute('surname', 'address-confirmation', (r, c) => c.data['address-confirmation']?.address !== undefined);

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
  && !c.data.edit?.edit
);
plan.setRoute('address-confirmation', 'post-code', (r, c) =>
  c.data['address-confirmation']?.__skipped__ &&
  c.data.skippedTo.__skipmeta__ === 'post-code'
  && c.data.skippedFrom.__skipmeta__ === 'address-confirmation'
  && !c.data.edit?.edit
);
plan.setRoute('address-confirmation', 'post-code-results', (r, c) =>
  c.data['address-confirmation']?.__skipped__ &&
  c.data.skippedTo.__skipmeta__ === 'post-code-results'
  && c.data.skippedFrom.__skipmeta__ === 'address-confirmation'
  && !c.data.edit?.edit
);
plan.setRoute('address-confirmation', 'url:///start/', (r, c) => c.data['address-confirmation']?.__skipped__ !== true && !c.data.edit?.edit);
plan.setRoute('address-confirmation', 'url:///check-your-answers/', (r, c) => c.data.edit?.edit === true);
