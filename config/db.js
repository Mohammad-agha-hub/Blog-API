import {Pool} from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect',()=>{
    console.log('A new connection made on pool!')
})

pool.on('error',(err)=>{
    console.error('Error',err.message)
    process.exit(-1)
})

// Helper function for query
async function query(text,params){
    try {
        const startTime = Date.now();
        const query = await pool.query(text,params);
        const duration = Date.now() - startTime;
        console.log(`Query executed, ${text},${duration}ms,rows:${query.rowCount}`)
        return query;
    } catch (error) {
        console.error('query error',{text,error:error.message})
        throw error;
    }
}

// Helper function for transaction
async function transaction(callback){
    const client = await pool.connect();
    try {
        await client.query('BEGIN')
        const result = await callback(client)
        await client.query('COMMIT')
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally{
        client.release()
    }
} 

export {pool,query,transaction}