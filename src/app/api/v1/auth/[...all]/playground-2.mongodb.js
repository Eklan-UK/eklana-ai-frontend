// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.


// Connect to your MongoDB and run:
use("elkan-db")
db.verifications.dropIndex("token_1")
db.verifications.createIndex({ token: 1 }, { unique: true, sparse: true })
