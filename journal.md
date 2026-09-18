This file is my braindump for this project. Will include notes on my understanding of all the features, updates and tradeoffs. Agents have been instructed to not touch this file, it is all my thoughts and reviews of the project at each incremental step.

### step 1

- setting up big.js. This is a dependency that will help with large numbers, high precision decimals and the maths required to manipulate them.
  - The reasoning behind this is that javascript (and computers in general) cannot store certain numbers with perfect accuracy using finite floating data types. This is because binary is a base 2 system, so numbers like 0.1 do not have a neat binary representation (it goes on forever).
  - It would be like trying to represent 1/3 with a base 10 system (decimals). 0.3333...
  - In javascript, the digits needed to represent a number like 0.1 exceeds the 64 bits assigned to numbers. This means trying to use vanilla javascript for calculations may introduce some rounding errors.
  - What big.js does to solve this is it converts numbers into a string and stores each digit in an array. By extracting the integers from a number (big or small), javascript can accurately represent and compute them since integers can be described nicely by binary. Once the computations are done, big.js can revert the numbers back using the sign and exponent that it knows about the number.
  - e.g., 0.1 + 0.2 might extract the 1 from 0.1, 2 from 0.2, add them, then apply the exponent of -1 to turn 3 into 0.3. This way, the accuracy is preserve at the cost of more memory and computation

### step 2

Will explain these changes using the 'describe' tests and explaining the flow of data:

- here we have a mock snapshot that we can expect from coinbase. The level 2 feed will contain two tuples, one for bids and one for asks. Each tuple is of type Snapshot level which just contains a price and quantity of type string. There will be more information in the feed but that isn't relevant right now.
  - with this snapshot, it will create a new object with a bids key and an asks key by passing the existing tuples into the loadSide method.
  - what this method does is take in a SnapshotLevels tuple (so just an array with a price string and a quantity string, and return a Map of string and pricelevel.)
    - first, it'll create an empty map of type string, pricelevel. PriceLevel is the object version of SnapshotLevel and will make handling the data later on easier due to the named keys
    - next, a complicated for loop is set up. here, it will extract the tuple values price and quantity from snapshotlevels (the array of tuples that was passed in from the createorderbook function)
  - after this, it will pass the price value into the canonicalPrice method to make sure it is a nice clean price, clipping off any redundant formatting so no duplicates are passed in as keys.
  - the if block then checks the quantity value from the tuple that is the point of focus of the current loop. if it is 0 then the key is deleted from the map. This is because it would mean that the snapshot contained a price level with no actual quantity inside, not an api failure just not needed for our local map that will later be used to display bids and asks.
  - it also checks to see if there are any duplicate keys. If there are, then the latest key is what sets the entry. This is by design
    - The feed is constantly updating. If a certain price level has a quantity attached to it, then a later entry has the same price with a different quantity, we don't want to register these are different bids or asks. We want to update the existing price level with the new quantity.
  - if the quantity is NOT 0, then the price and quantity of the snapshot is converted into an object of type pricelevel.
- the array of tuples has now been converted to a map of key and {price, quanitity}. This is returned
- Now createorderbook has two maps: a bids map (of key, {price, quantity}) and an asks map of the same type.
- back to our first test, we go into our book object, into the bids object, then pull out the size property to ensure we have 12 entries. All non 0 entries will have been deleted by now. Then we check the '100' key to look for a quantity of the fixtures: ["100.00", "1.00000000"]. same with the asks object.
- our createOrderBook method will also wipe our map clean when a new snapshot is passed in. It is not saved (plans on updating this post-MVP)

selectTopLevels tests:

- Here, we pass in the orderbook that has been converted by createorderbook into the selectTopLevels method - the for of loop just pulls out the bids and asks objects within the book and passes them into the method that sorts the price level, selectSideLevels
  - first, we define an empty array that will store pricelevel objects.
  - here, each level (which is just a price and quantity object) is looped through. In the loop, we compare the current price against the price of the relevant index of the original array we defined at the start. if its a bid, then we scan the array until we find an entry where the price of the current level is greater than the price of the stored level in the 'selected' array. If so, then we set our index variable to this position. For the 'ask' version, it is the opposite - we set the index variable to the position where a value lower than the stored value is found.
    - if there was no entry for this, e.g,. comparison > 0 returned false, then index would be set to -1. If -1, then we push this current level into the array at the top of the method, as long as we have no surpassed the limit for the list of entries (10 in this case)
    - if we DO find a match, then we splice the found entry from the unsorted level into the sorted one, and pop any values that exceed the visibile levels limit which is the lowest value
  - all of this to say, the selectsidelevels method sorts 10 pricelevel entries in order of high to low for bids, and low to high for asks and pops the rest, without changing the original map.

### step 3

- from the coinbase api, we get 'snapshots' which contains the data we need to create our orderbooks. When a new snapshot comes in, createOrderBook can create a fresh book to ensure no stale data.
- however, it also provides 'updates' through the websocket connection. In these smaller packets of data, it provides us with side, price and quantity data.
- In this step, we process these updates with a new method, applyChanges. This method will take the original book and pass in the changes too. The original book will get mutated by slotting in new prices as new entries in the map and updating existing prices with the new quantities from the update.
- These new prices are processed synchronously to ensure the latest values win
- To prevent this method from repeating too much logic from loadSide, we have abstracted the logic that removes 0 quantity prices from the book map, updates old prices with new quantities, and slots in new prices. This new method is called applyLevel and is used in both loadSide (initial population of our bid and ask maps) and now applyChanges
- The fixtures file has a new entry to mimic what updates would look like from coinbase. We have gone with 3 levels. Level 1 includes a new price that does not exist in the original book. Level 2 ensures that prices that appear as different strings but have the same value still update the same key. Level 3 ensures that 0 quantity prices are removed from the map.
- the top 10 quantities are therefore representative of the latest information, as it is the original book object that gets updated. From here it can be passed through our sorting method selectSideLevels to reorder the top 10 if need be.

### step 4

- new format.ts file to help us with certain operations we'll need when displaying long numbers / decimals
- first up we have formatDecimal, which takes in a value (string) and a number which represents the MINIMUM number of digits we want to format the value
- we pass the value string into parceDecimal (method from decimal.ts from step 1) which turns it into a Decimal type (big.js package helps with this) then we turn it into a string AGAIN with .toFixed() and split it at the .
  - once split, we assign the left side of the dot as const integer and the right side as const fraction (which defaults to "" if there is no value)
- Next, we use .replace and some regex to see where there are positions in the string that has 3 digits remaining to its right, then inserts a comma.
  - then, we add as many 0s as needed to the fraction portion to meet the requirement from the 'minimum decimals' argument. If the fraction portion already exceeds the minimum decimals then no padding is added.
- Finally, we return the final formatted decimal with the grouped integer (number with commas) followed by a decimal and then the fraction portion of the number.

- The new formatReceiptLabel method takes in a number of milliseconds since 1 January 1970 UTC (or null) and returns a nicely formatted date.

bookview.ts:

- Essentially just a function that takes our order book, passes it through our already exisiting sorting function, then formats some of our values and returns an object with all the values our display might be interested in
- To break it down into more detail, the main function is createBookView, where we receive the order book object (unsorted) and a number that represents when we recieved the snapshot.
- the function passes the book object into our already existing selectTopLevels function (which just sorts the data - bids and asks separately)
- then creates an array that stores the top bids and the top asks.
- column precision returns a number to say "at this current level, this is how many decimal places the MOST precise value has". With this level of precision, we pass this number into formatDecimal which will then pad all the numbers with as many 0s as needed to match the number of decimal places of the most precise value.
  - TODO: need to decide in the future if I still want this functionality. Right now, it exists to support any prices or quantities that come in through the websocket with higher precision than expected. However, in the future, for the sake of a consistent ui that isn't constantly flickering, I may get rid of the column precision method and just pad all prices and quantities to a certain number of decimal places, and truncate / round after this point. e.g., 4 d.p for prices and 8 d.p for quantity. The current functionality supports quantities that are passed in with 10 d.p, then will pad every other number in the column with enough 0s to match its digits.
- the toRow function then creates rows of objects that represent a singular price level (bids and asks seperately), including a unique id, price, quantity and labels for these variables too
- uses object.freeze to make sure none of the variables can be mutated once it is set to a row
  - object.freeze is used quite a few times here. Upon some further discovery, this method is conceptually similar to typescript's 'readonly' tag, but object.freeze exists on a javascript runtime level.
  - prevents shallow mutation of an object. This is why its called so many times, to freeze the respective variables that we don't want to be changed
- best bids and asks are set by drawing out the first value in each respective array (select side level will organise 'best' price from index 0 onwards, regardless of bid or ask)
- entire function then returns these variables, also freezing it and using placeholders where the values aren't available

UPDATE:

- After reviewing further, decided to remove the object freezing. I understand its defensive intent, it prevents any rows from being mutated, which we do not want. However, these rows will be constantly replaced as updates are streamed in from coinbase. Freezing them adds an extra layer of work and cognitive complexity that doesn't really protect against anything other than a strict warning to other devs to not mutate these rows. I will remove it for the sake of keeping this project lean, and review it if any issues regarding mutation during runtime occur.

### step 5

Essentially, the goal of this step was to review the shape of the data that would be received from coinbase (using the docs) and create some validators that would confirm that is actually what we received. This step is important because all of our logic assumes that the data we recieved is already in this shape - would be irresponsible to pass in data that hasn't been validated.

- my first step was reviewing the shape of the messages I would be receiving from coinbase. There are many but the ones relevant to this project are snapshots, l2update, heartbeat and subscriptions. Coinbase shows what the shape of each of these types will look like, so every validator function tests each layer of these shapes.
- the most fundamental ones are checks like nonempty strings and record checks (want it to be an object, not an array)
  - on the topic of arrays, the agent implemented 'Array.isArray()' quite often and I wondered why this was being used instead of typeof value === 'array' or something similar.
  - upon further research, there are some edge cases where instanceof array will return a false negative
  - it looks at the data types prototype, and if it cannot find array it will return false, however, there are edge cases where arrays can be constructed without the array prototype
  - Probably not relevant for this specific project but a non harmful and upgraded way to ensure our array checks are accurate
- We also check for quantities using regex and prices with the help of our big.js functions
- ultimately, each function checks to see if what is being passed in matches the documented datashapes from coinbase.
- The final function of this file takes in the raw json and methodically returns early or throws an error case by case, ending at a switch statement that returns the expected validation messages based on the type of data we're receiving

### step 6

- Very simple update. Mostly agent driven. Created a skeleton / first draft of the landing dashboard.
- Uses tailwind for styling, semantic headings and is responsive.
- also updated all references to usd to gbp

### step 7

The outline of the dashboard has been set. From top to bottom:

- section 1 will be the market header - this will contain the asset being viewed as well as connection status
  - connection status will be announced via screenreaders due to aria-live logic (polite so it won't interrupt anything being read out, and atomic so the entire label is read out)
  - Upgrade? -> dropdown here to look at more assets in the future
- section 2 will contain the 'data freshness' section. Here, users will be able to see if the data they're looking at is good / fresh, stale, or in a waiting state
  - Some clarification here: the waiting state will mean that we are expecting an initial orderbook to come through
  - the stale section means the data being looked at is outdated. Stale state may come about as a result of a failed update within a batch - our current logic throws out entire batches if any information is invalid. This would mean some correct data may be thrown out, so its important to label the data being displayed as stale
  - TODO: will investigate a lot of this logic later on with React Suspense in mind
- section 3 is the market overview section, this will simply show the best bid, best ask and spread from the data it is being fed
- section 4 is the actual order book. Here we can see bids and asks in separate tables, side by side.
  - upgrade? -> dropdown to decide how many levels are visible? currently at 10
  - some cool features here: the table itself has accessibility features like declaring the scope of table info.
  - The dimensions of the table are fixed. This means that even if the orderbook size falls short and there are less than 10 entries on either side, the table will not shrink or change size. Stable dimensions means less strain on the eyes and easier comparisons.
    - Currently not a fan of the layout. It looks nice enough but I would prefer it to be more functional, meaning the gap between the tables will be removed in the future. Will have the two tables sit closer together with an easier way to compare the bids vs the asks. Right now, the eye has to move quite far to make these comparisons. May also switch the order of the headers around to make it symmetrical, e.g., price quantity | quantity price. This is dependant on which header I think makes the best comparison. May even make a 'volume' header the focal point - I'll need to make a new derived value in my orderbook logic that calculates this.
    - Some ideas for now: highest volume in the available sorted data will be represented by a bar that takes the whole width of the table. Subsequent bids / asks will have shrinking bars proportional to their volume. This way, can see the distribution of bids and asks at a glance by seeing the shape of the data.
    - Also want to experiment with table lines. There aren't many now but will assess how clear it is to view the data vs how cluttered it would look with row and column separators
- section 5, the final section, will just show the most recent receipt label so we have a timestamp for when the application last received data

Extras:

- Added a dev view to test out what different fixtures would look like when passed in. Populated states, empty states, mixed states etc

Will need to consider how often I show updates, where I'd like to implement suspense boundaries, what transition logic I'd like to introduce, tradeoffs between pleasant ui and fast, functional data.

Tradeoffs made:

- cleaned up some clutter, e.g., removing units from table headers since they are mentioned in the paragraph tag above.
  - This could confuse screen readers who skip straight to the table so added a screen reader only span that clarifies the units for the headers
- First shot at this step had all the logic sitting inside App.tsx. I personally prefer keeping this file quite lean, so abstracted most of the logic out, utilising the atomic file structure that I'm used to
  - All thats left in App.tsx now is the state that needs to be passed down into the child components

### step 8

This step involves setting up the WebSocket controller and some tests using a fake socket and some new fixtures

- the main new function here is createBookFeed. This is the function that handles setting up the WebSocket connection and handling the different types of events.
- at first it will create a bunch of empty variables that will get populated throughout the websocket process. Things like a null book object and a state object.
- early on in the function, we define an important function: dispose. What this function does is removes all the handlers and closes the connection. It is also idempotent so can be called multiple times (returns early if disposed boolean is true, and sets it to true after this check)
  - websockets come with a bunch of events, like open, close, message and error. Its through these events that information is streamed between the client and the server. For example, we start off with an open even and then send a message asking for the specific products we want. A message event is then sent back with the data we want.
  - this dispose function is particularly important since it closes the events -> essentially shutting down the streaming
  - All the functions are constantly listening out for events, which is why they're so defensive. For example, the connection might already be in the process of closing but while that is happening, it might sent out many objects of data. One particular property of a socket is called readyState
    - this will return numbers 0-4 which represent different levels of connection, from 'connecting' to 'open' to 'closing' to 'closed'
    - the dispose function will check to see it the number is 0 or 1 before calling the close method
- the fail function comes next and is responsible for updating the state object with an error message.
  - many other functions call fail, even the handler that closes the connection will call the fail method with a message that conveys the connection is closed
- Next, we attempt to set up the websocket inside a try catch block. If it fails then we pass the error message into the fail function which can be shaped to give the consumer the information they need. If it succeeds then it starts the process of establishing a connection to the server
- once the websocket is created, the open event is fired. Here, we check if disposed or opened is true, in either of these cases we do not want to do anything and can early return. However, if we have not done anything after opening and we're not in the process of disposing, we attempt a send.
  - Here, we send out a json object where we make the initial subscribe request. We update the state to synchronising while this is happend (and account for the failure case)
- The other event we listen out for is the message event. If we're disposing or haven't opened yet, we early return. Otherwise, we check to see if the data in the event message is a string. If not, we throw and error and if yes then we attempt to decode the data.
  - we do not want the message to be a subscriptions type, this doesn't provide any information we can make a book or update out of
  - If it is of type snapshot, we create an orderbook and update our view with this book and the timestamp of when we processed that we received a snapshot
  - if it is an update, we make sure we have a snapshot first (or else throw an error) then call the a method to slot in the updated data into a fresh book view.
  - if its a heartbeat type then we just track that we're ready and break out.
- only if we have a valid book object and our heartbeat is ready do we claim that we're live, otherwise it will set to synchronising (unless an error or failure)
- Finally, the last return returns a callback to dispose. This means a const can be assigned to this function and invoked whenever it needs to be disposed (which handles removing the handlers and closing the connection)

- The tests are comprehensive. They cover many edge cases and take advantage of new fixtures and a fake websocket. I have added a bunch of console logs that can be toggled with a boolean at the top of the file. When this is set to true we can see what the data flow of a websocket connection might look like between a consumer, the controller and the socket

### step 9

Very interesting step here. The aim was to implement retry logic, backoff logic and even jittering. I learned a lot through different documents, including the websocket protocol document and an aws document that explains how they handle timeouts, retries and jitter:
https://www.rfc-editor.org/rfc/rfc6455.html#section-7.2.3
https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf

I didn't quite understand why this was needed but the reasoning is highlighted in section 7.2.3 in the web socket protocol all the way back in 2011. Essentially, some errors can be transient, meaning some temporary failure among the chain of communication from client to server. In these cases, a retry usually fixes the error or failure.

However, sometimes the error can be more substantial - such that retrying would just cause unnecessary load on the server and potentially even cause a denial of service-like load. The solution to this is 'backoff', which just means that you should retry, but just space out the retries so the server has some space to breathe. The 2011 document also highlights that backoff retries should also be delayed by increasingly longer intervals.

Lastly, we have jitter. To simplify, it boils down to adding some randomness to the delay when making a retry attempt. The reason for this is that if every client that was requesting data from coinbase suddenly received a failure then continued to retry, then the services might become overloaded before it can recover. Most of these clients will probably include some backoff logic, but if everyone made the same retry attempt in 1s, then 5s, then 10s, then 30s, etc then the service may have a little room to breathe but would still be getting attacked in clusters.

This is why the jitter logic is a little overkill for this project, because the likelihood that my non-jitter retries are perfectly inline with other clients is pretty low. I'm going to leave it in anyway because I like the logic and is ultimately a positive.

New code updates:

- Simple explanation: no more failure state, we just continue to retry if anything causes a failure. The retries will happen with longer delays each time (up to max), and will have some slight randomness to them.
  - this includes everything that causes a failure, such as an update that arrives before a snapshot like we mentioned in the previous step. The function will now close the socket and attempt a retry to establish a new connection

More detail:

- initial retry ceiling is 1s, which will scale up to the max retry length of 30s. Will continue to retry at random intervals close to the max until application is stopped or manual user intervention (I would like to add this feature)
  - healthy session const is also 30s and refers to how long we need to establish a 'live' connection before we reset the backoff timer
  - Speaking of, we have removed the failed status and replaced it with reconnecting. This is because the app will continually try to reconnect unless stopped. (or user manually disconnecting)
- introduced a new 'isStale' variable that will update to true when the fail function is invoked. This will only be updated when the 'live' boolean is set to true (after reconnection is successful)
  - This is a separate boolean that tracks when data is unreliable when looked at
- A lot of the dispose logic that was responsible for setting the handlers to null and closing the socket has now been abstracted to a 'closeSocket' function.
- the dispose function now increments attemptId, which can act as an invalidation token, clears the timers and calls the closesocket function
- new 'connect' function that replaces the old try catch logic that would send out the first attempt to establish a connection.
  - this introduces an important 'isCurrent' function which checks to see if we're on a current attempt. attemptId is incremented every time we call dispose, fail and connect. If the id variable tracking attemptId is mismatched, it would only be because of of an increment caused by another function - acting as an invalidation token
- if the function has made it to this point then it will update the state to 'connecting...'
- After this we'll attempt to establish the connection by creating the web socket object.
  - we track the socket object with a new variable called attemptSocket, which just points to the same object that socket points to when created while surviving and 'socket = undefined' calls that happen on disposal / closeSocket()
  - from here its basically the same logic as the previous step with the switch that checks for message type from coinbase
  - one new feature is the healthytimer. Live can be true as long as book is not null and a heartbeat has come through, however, it needs to have been true for 30 seconds before we reset the backoff timer. That means, as we're increasing the delay, if we get a temporary live status we don't just immediately snap back to our initial retry value of 1000 ms. If we fail 5s in, then the backoff timer will continue to grow from the latest delay, not start fresh.
  - One key thing to note here is how connecting again always creates a fresh book. We don't want to build on any stale data so we just clear it out and request a new snapshot from the websocket.

  - Loads more i learned in this step: refresher on callbacks, closures and a lot of the logic around the id, attemptid and setTimeout function but this is more vanilla javascript that is not project specific or interesting to note.
