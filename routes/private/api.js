const {
  isEmpty
} = require("lodash");
const {
  v4
} = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const Graph = require('node-dijkstra')

const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }
  console.log("hi", sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userid",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleid",
      "se_project.roles.id"
    )
    .first();

  console.log("user =>", user);
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  console.log("user =>", user)
  return user;
};

const checkPrice = (noOfStations) => {
  // 0-9 5 pounds
  // 10-16 7 pounds
  // 16+ 10 pounds

  if(noOfStations < 10) {
    return noOfStations * 5
  } else if(noOfStations < 17) {
    return noOfStations * 7
  } else {
    return noOfStations * 10
  }
}



module.exports = function (app) {
  // example
  app.get("/api/v1/users", async function (req, res) {
    try {
      //  const user = await getUser(req);
      const users = await db.select('*').from("se_project.users")
      
      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
    
  });
  
  app.get("/api/v1/user/:id", async function (req, res) {
    try {
      //  const user = await getUser(req);
      const users = await db.select('*').from("se_project.users")
      
      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
    
  });
  app.put("/api/v1/requests/refunds/:requestId",async function(req,res){
  
    // check for authenticity since only the admin can accept and reject requests
  
    const user = await getUser(req);
    if(!user.isAdmin){
      return res.status(401).send("Unauthorized");
    }
   // after authenticity check, admin can now view the request
   const requestId=req.params.requestId;
   const request=await db.select("*").from("se_project.refund_requests").where("id",requestId).first();
   if(isEmpty(request)){
     return res.status(404).send("request not found");
   }
  
  //validate if the ticket is valid
  const ticketId=request.ticketid;
  const ticket=await db.select("*").from("se_project.tickets").where("id",ticketId).first();
  if(isEmpty(ticket)){
    return res.status(404).send("ticket not found");
  }
  //validate if the ticket belongs to the user
  
  
   //admin can now accept or reject the request
    const {refundstatus}=req.body;
    if(!refundstatus){
      return res.status(400).send("refund status is required"); //in case admin forgets to add the refund status
    }
    
    const newStatus = {
      status : req.body.refundstatus
    }
  
    try {
      const request = await db("se_project.refund_requests").update(newStatus).where("id",requestId).returning("*");

      
      return res.status(200).json("updated refund status");
  
    }catch(e){
      console.log(e.message);
      return res.status(400).send("Could not update refund status");
    }
  
  
  });
  
  app.put("/api/v1/password/reset", async function (req, res) {
    try {
      const {
        newPassword
      } = req.body;
      if (!newPassword) {
        throw "Password is required"
      }
      await db.select('*').from("se_project.users").where('id', req.userid).update('password', newPassword)

      return res.status(200).json("User password reset successfully");
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }

  });

  app.post("/api/v1/tickets/price/:originId/:destinationId", async function (req, res) {
    const {
      originId,
      destinationId
    } = req.params;
    
    const stationRoutes = await db.select('*').from("se_project.stationroutes")
    const routeStations = stationRoutes.reduce((prev, {
      stationid,
      routeid
    }) => {
      prev[routeid] = [...(prev[routeid] || []), stationid];
      return prev
    }, {})

    const staionStaions = stationRoutes.reduce((prev, {
      stationid,
      routeid
    }) => {
      prev[stationid] = [...new Set([...(prev[stationid] || []), ...routeStations[routeid]])];
      return prev
    }, {})

    const route = new Graph()
    Object.entries(staionStaions).forEach(([key, value = []]) => {
      route.addNode(key, value.reduce((prev, current) => {
        prev[current] = 1
        return prev
      }, {}))
    })

    const numberOfStations = route.path(originId, destinationId)

    return res.status(200).send({
      price: checkPrice(numberOfStations.length)
    });
  });

  app.put("/api/v1/ride/simulate", async function (req, res) {
    const {
      origin,
      destination,
      tripDate
    } = req.body;
    
    const stationRoutes = await db.select('*').from("se_project.stationroutes")
    const routeStations = stationRoutes.reduce((prev, {
      stationid,
      routeid
    }) => {
      prev[routeid] = [...(prev[routeid] || []), stationid];
      return prev
    }, {})

    const staionStaions = stationRoutes.reduce((prev, {
      stationid,
      routeid
    }) => {
      prev[stationid] = [...new Set([...(prev[stationid] || []), ...routeStations[routeid]])];
      return prev
    }, {})

    const route = new Graph()
    Object.entries(staionStaions).forEach(([key, value = []]) => {
      route.addNode(key, value.reduce((prev, current) => {
        prev[current] = 1
        return prev
      }, {}))
    })

    const ss = route.path(origin, destination);
    const ride = await db("se_project.rides").update({
      status: "completed"
    }).where({
      origin,
      destination,
      tripdate: tripDate
    }).returning("*");

    return res.status(200).send({
      stations: ss,
      ride
    });
  });

  app.delete('/api/v1/station/:stationId', async function (req, res) {
    const {
      stationId
    } = req.params;
    const routes = await db.select('*').from("se_project.routes");
    const stationRoutes = await db.select('*').from("se_project.stationroutes");
    const routeStations = stationRoutes.reduce((prev, {
      stationid,
      routeid
    }) => {
      prev[routeid] = [...(prev[routeid] || []), stationid];
      return prev
    }, {})

    const staionStaions = stationRoutes.reduce((prev, {
      stationid,
      routeid
    }) => {
      prev[stationid] = [...new Set([...(prev[stationid] || []), ...routeStations[routeid]])];
      return prev
    }, {})

    const station = await db.select('*').from("se_project.stations").where("id", stationId).first();
    if(!station) {
      return res.status(400).send({
        message: 'No station with that ID'
      });
    }
    const { stationposition, stationtype } = station || {};

    if(stationposition === "middle") {
      if(stationtype === "transfer") {
        const [first, ...rest] = (staionStaions[stationId] || []).filter(el => el != stationId);
        
        rest.forEach(async (el) => {      
          const r1 = await db("se_project.routes").insert({
            routename: "hi" + first + el,
            fromstationid: first,
            tostationid: el
          }).returning('*')
          await db("se_project.stationroutes").insert({
            stationid: first,
            routeid: r1[0].id
          })
          await db("se_project.stationroutes").insert({
            stationid: el,
            routeid: r1[0].id
          })

          const r2 = await db("se_project.routes").insert({
            routename: "hi" + el + first,
            fromstationid: el,
            tostationid: first
          }).returning('*')
          await db("se_project.stationroutes").insert({
            stationid: first,
            routeid: r2[0].id
          })
          await db("se_project.stationroutes").insert({
            stationid: el,
            routeid: r2[0].id
          })
        })
      } else {
        const otherStations = (staionStaions[stationId] || []).filter(el => el != stationId);
        
        const r1 = await db("se_project.routes").insert({
          routename: "hi" + otherStations[0] + otherStations[1],
          fromstationid: otherStations[0],
          tostationid: otherStations[1]
        }).returning('*')
        await db("se_project.stationroutes").insert({
          stationid: otherStations[0],
          routeid: r1[0].id
        })
        await db("se_project.stationroutes").insert({
          stationid: otherStations[1],
          routeid: r1[0].id
        })

        const r2 = await db("se_project.routes").insert({
          routename: "hi" + otherStations[1] + otherStations[0],
          fromstationid: otherStations[1],
          tostationid: otherStations[0]
        }).returning('*')
        await db("se_project.stationroutes").insert({
          stationid: otherStations[0],
          routeid: r2[0].id
        })
        await db("se_project.stationroutes").insert({
          stationid: otherStations[1],
          routeid: r2[0].id
        })
      }
    }

    await db.delete().from("se_project.stations").where('id', stationId)
    await db.delete().from("se_project.routes").where('tostationid', stationId)
    await db.delete().from("se_project.routes").where('fromstationid', stationId)
    await db.delete().from("se_project.stationroutes").where('stationid', stationId)
    
    return res.status(200).send({
      message: 'Deleted Successfully'
    });
  })
};
