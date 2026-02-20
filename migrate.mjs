import fs from 'fs';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://rolandmoint_db_user:0oeAxLKrwZEPALZz@cluster0.04y589s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('fun_chinese_db');
    const usersCollection = db.collection('users');

    const registryData = JSON.parse(fs.readFileSync('./api/registry.json', 'utf8'));

    let count = 0;
    const cleanUsers = registryData.users.map(u => ({
         ...u,
         username: u.username.toLowerCase(),
         email: u.email ? u.email.toLowerCase() : null
    }));
    
    // Assign legacy passwords recursively inside
    const finalUsers = cleanUsers.map(user => {
        if (!user.password && registryData.legacyPasswords && registryData.legacyPasswords[user.username]) {
            user.password = registryData.legacyPasswords[user.username];
        }
        return user;
    });

    if(finalUsers.length > 0) {
        for (const user of finalUsers) {
             await usersCollection.updateOne(
                  { username: user.username },
                  { $set: user },
                  { upsert: true }
             );
             count++;
        }
        console.log(`Success! ${count} users successfully migrated from JSON to MongoDB.`);
    }

  } catch(e) {
    console.log("Migration Error: ", e)
  } finally {
    await client.close();
  }
}
run();
