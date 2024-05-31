# CASA-New-Address-Flow
This dummy project demonstrates the address flow as per the (GDS Guidelines)[https://design-system.dwp.gov.uk/patterns/find-an-address]. 

## How to Run 
Run: 
- `npm i` 
- open a terminal and run `npm run start:mock` (this starts the mock address lookup API)
- open a new terminal and run `npm run start:service` (this starts the CASA app)
- Open browser and navigate to `http://localhost:3000/start`
- When doing the address lookup by post-code, `IP4 3HT` returns a list of 6 addresses, `IP4 3HU` returns a list of 1 address, and any other post-code returns `no address found`

The flow is like this: 
- name
- surname 
- post-code (where the user can input post-code)
- post-code-results (addresses for given post-code are displayed)
- address-confirmation 
- address-manual (page that is accessible at any point so the user can manually input the entire address)

## Explanation of Code
### app/utils.ts
The magic happens mostly in `app/utils.ts`. 

The function `removeWaypointsFromJourneyContext` removes all data for waypoints that you pass to it as an arguement. 

N.B: in CASA, when you skip a waypoint, it sets the data for that page as `{ __skipped__: true }`. However, since the routing is complex, it really helps to store the `skippedTo` and `skippedFrom` data: 

```  
(req as any).casa.journeyContext.setDataForPage('skippedTo', { __skipmeta__: skipto });
(req as any).casa.journeyContext.setDataForPage('skippedFrom', { __skipmeta__: waypoint });
```

The above snippet came from `applySkipMeta` function. 

The function `prepareJourneyMiddleware` prepends the `prependUseCallback` function to all the address flow related pages.

In CASA, each waypoint is served by the `journeyRouter`. Each waypoint is essentially just an endpoint, that is accessible with 2 types of requests, `GET` and `POST`. Loading a question page is achieved with a `GET` request. After interacting with the page and clicking the `Continue` button - the data from the page form is sent in a `POST` request. 

The function `prependUseCallback` is therefore required to handle both cases, the `GET` and `POST` cases. This is why I made a clear separation for when the `req.method === 'GET'` and `req.method === 'POST'`. 

In the `GET` section - we retrieve the copy of the data from the temporary waypoint `temp-${waypoint}`, and we set the current waypoint with that data if its defined. In the rest of of `GET` section, we handle the cases when the user is trying to skip somewhere. 

In the `POST` section - we handle the case where the user submits data. In this section we save the data submitted to `waypoint` inside `temp-${waypoint}`. Also, for the `post-code` waypoint - we need to call an API and retrieve the addresses for that post-code, so this is where the API call happens. The results are stored in `found-address-data` waypoint. 

In order for the back button to work on `address-confirmation` page, we need to make sure CASA resolves what the previous waypoint in the journey is. For this reason, I added a `route` waypoint - which is either `manual` (if the user inputted the address in the `address-manual` page), or `automatic` (if the user inputted the address in the `post-code` and `post-code-resultds` pages). This flag is important for the back button to work, and it is set when `POST`ing data to `address-manual` and `post-code` waypoints. It is then cleared on `POST` request to `address-confirmation` - this allows us to skip from `surname` directly to `address-confirmation` the next time the user goes through the journey after completing it.

### check-your-answers.ts
You can see that we set the addressRow like so: 

```
  const addressRow = {
    key: {
      text: 'Address'
    },
    value: {
      text: addressData.address,
    },
    actions: {
      items: [
        {
          text: "Change your answer",
          href: "/edit-address"
        }
      ]
    }
  };
```

The `href` is pointing to `/edit-address`, which you can see is just an endpoint that sets `journeyContext.setDataForPage('edit', { edit: true });` and calls `res.redirect('/address-confirmation');`. The reason why we don't follow the normal CASA convention of using `waypointUrl({ waypoint: 'surname', edit: true, editOrigin: 'check-your-answers'})` as we did with the surname, is because the routing is more complex. Using the `waypointUrl` function will not allow the user to click `search again` for example. So this is why we internally set the `edit` flag to true - which is then used to determine where to navigate the user after completing the address - `plan.setRoute('address-confirmation', 'url:///check-your-answers/', (r, c) => c.data.edit?.edit === true);`. As you can see the routing in `plan.ts` navigates the user from `address-confirmation` to `check-your-answers` if the flag is set to true.

In the `checkYourAnswers` function - we set a flag `journeyContext.setDataForPage('edit', { edit: false });` - which resets the above functionality. 


