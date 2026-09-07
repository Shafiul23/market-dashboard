### commit 1

- setting up big.js. This is a dependency that will help with large numbers, high precision decimals and the maths required to manipulate them.
  - The reasoning behind this is that javascript (and computers in general) cannot store certain numbers with perfect accuracy using finite floating data types. This is because binary is a base 2 system, so numbers like 0.1 do not have a neat binary representation (it goes on forever).
  - It would be like trying to represent 1/3 with a base 10 system (decimals). 0.3333...
  - In javascript, the digits needed to represent a number like 0.1 exceeds the 64 bits assigned to numbers. This means trying to use vanilla javascript for calculations may introduce some rounding errors.
  - What big.js does to solve this is it converts numbers into a string and stores each digit in an array. By extracting the integers from a number (big or small), javascript can accurately represent and compute them since integers can be described nicely by binary. Once the computations are done, big.js can revert the numbers back using the sign and exponent that it knows about the number.
  - e.g., 0.1 + 0.2 might extract the 1 from 0.1, 2 from 0.2, add them, then apply the exponent of -1 to turn 3 into 0.3. This way, the accuracy is preserve at the cost of more memory and computation

### commit 2

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
