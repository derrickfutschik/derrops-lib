# OpenAPI Matching Schema

For each request, we will perform the following steps:

1. Find the Matching Server with Lookup O(1), (Do not consider time at this stage) 2.`Operation Search` Find all Operations with the correct number of segments, O(1) (Dynamo DB Lookup)
2. Construct the **OpenPAI Matching Trie**, if not there already for that number of segments. If the tree is already there, add the operations to the tree
3. Perform a lookup in the trie to find the matching operation, O(1)

Note that the Trie will be
Note that `Operation Search` will be batched, to minimize round trips.

## TODO

1. Smart lookup, have operations reference their parent, so that you can do a search such as, children of this path
