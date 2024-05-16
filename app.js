const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const sqlite3 = require('sqlite3')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDbandServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('server started....')
    })
  } catch (e) {
    console.log(`Error Occured\n${e}`)
  }
}

initializeDbandServer()

const authenticationWithToken = (request, response, next) => {
  let jwtToken

  const authHeader = request.headers['authorization']

  if (authHeader) {
    jwtToken = authHeader.split(' ')[1]
    if (jwtToken) {
      jwt.verify(jwtToken, 'qwertyuiop', (error, playload) => {
        if (error) {
          response.status(401)
          response.send('Invalid JWT Token')
        } else {
          next()
        }
      })
    } else {
      response.status(401)
      response.send('Invalid JWT Token')
    }
  } else {
    response.status(401)
    response.send('Invalid JWT Token')
  }
}

app.post('/login', async (request, response) => {
  const {username, password} = request.body

  const userQuery = `
    select * from user where username = "${username}";
    `

  const dbUser = await db.get(userQuery)

  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const comparedPassword = await bcrypt.compare(password, dbUser.password)

    if (!comparedPassword) {
      response.status(400)
      response.send('Invalid password')
    } else {
      let payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'qwertyuiop')
      response.send({jwtToken})
    }
  }
})

app.get('/states', authenticationWithToken, async (request, response) => {
  const stateQuery = `
    select state_id as stateId , 
    state_name as stateName,
    population 
    from state;
  `

  const dbResponse = await db.all(stateQuery)

  response.send(dbResponse)
})

app.get(
  '/states/:stateId/',
  authenticationWithToken,
  async (request, response) => {
    const {stateId} = request.params

    const stateQuery = `
    select state_id as stateId , 
    state_name as stateName,
    population 
    from state
    where state_id = ${stateId};
  `

    const dbResponse = await db.get(stateQuery)
    response.send(dbResponse)
  },
)

app.post('/districts/', authenticationWithToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const districtQuery = `
  insert into district(district_name , state_id , cases , cured , active , deaths) VALUES 
  ("${districtName}" , ${stateId} , ${cases} ,${cured} , ${active} , ${deaths} );
  `
  try {
    await db.run(districtQuery)
    response.send('District Successfully Added')
  } catch (e) {
    console.log(`Error found...\n${e}`)
  }
})

app.get(
  '/districts/:districtId/',
  authenticationWithToken,
  async (request, response) => {
    const {districtId} = request.params

    const districtQuery = `
    select district_id as districtId , 
    district_name as districtName , 
    state_id as stateId,
    cases , cured , active , deaths
    from district
    where district_id = ${districtId};
  `

    const dbResponse = await db.get(districtQuery)
    response.send(dbResponse)
  },
)

app.delete(
  '/districts/:districtId/',
  authenticationWithToken,
  async (request, response) => {
    const {districtId} = request.params

    const districtQuery = `
  delete from district 
  where district_id = ${districtId};
  `

    await db.run(districtQuery)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticationWithToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const districtQuery = `
    update district 
    set 
      district_name = "${districtName}",
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured} , 
      active = ${active} ,
      deaths = ${deaths} 
      where 
        district_id = ${districtId}; 
    
    `
    try {
      await db.run(districtQuery)
      response.send('District Details Updated')
    } catch (e) {
      console.log(`error found...\n${e}`)
    }
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticationWithToken,
  async (request, response) => {
    const {stateId} = request.params
    const stateQuery = `
  select 
    sum(district.cases) as totalCases,
    sum(district.cured) as totalCured,
    sum(district.active) as totalActive,
    sum(district.deaths) as totalDeaths
    from district inner join state on 
    district.state_id = state.state_id
    where state.state_id = ${stateId}
    group by state.state_id;
  `

    const dbResponse = await db.get(stateQuery)
    response.send(dbResponse)
  },
)

module.exports = app
