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
