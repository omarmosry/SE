const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
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

  app.put("/api/v1/password/reset", async function (req, res) {
    try {
      const { newPassword } = req.body;
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
  app.post("/api/v1/payment/ticket", async function (req, res) {
    const { purchasedId, creditCardNumber, holderName, amount, origin, destination, tripDate } = req.body;
    const subs = await db.select(["subtype", "nooftickets"]).from("se_project.subsription").where('userid', req.userid)
    
    let ticket = null;
    console.log(subs);
    if (subs.length === 0) {
      console.log("innn");
      await db("se_project.transactions").insert({ purchasediid: purchasedId, amount: amount, userid: req.userid })
      ticket = await db ("se_project.tickets").insert({origin:origin ,destination:destination, userid: req.userid ,tripdate:tripDate }).returning("*")
    } else {
      const notickets = await db.select("nooftickets").from("se_project.subsription").where('userid', req.userid)
      console.log();
      if (notickets != 0) {
        notickets = notickets - 1
        const update = await db.select("nooftickets").from("se_project.subsription").where('userid', req.userid).update("nooftickets", notickets)
        log.console(update)


      }


    }
    console.log(ticket);

    res.status(200).send({ticket})
  })
  app.post("/api/v1/senior/request", async function (req, res){
  const{nationalId}=req.body;
  console.log(nationalId);
   const Rstatus = "pending"
  SenReq = await db("se_project.senior_requests").insert({status:Rstatus,userid:req.userid, nationalid:nationalId}).returning("*")
  res.status(200).send({SenReq})
  });
  app.put("/api/v1/route/:routeId", async function (req, res){
    try{
    const{routeName}=req.body;
    console.log(routeName)
    UpRoute = await db('se_project.routes').update({routename: routeName}).where('id',req.params.routeId).returning("*")
    res.status(200).send({UpRoute})  }
    catch(e){
      console.log(e.message);
      res.status(400).send(e.message)
    }
  });
  app.put ("/api/v1/station/:stationId",async function (req, res){
    try{
      const{stationName}= req.body;
      console.log(stationName)
      UpdateStation = await db("se_project.stations").update({stationname:stationName}).where('id',req.params.stationId).returning("*")
      res.status(200).send({UpdateStation})
    }
    catch(e){
      console.log(e.message);
      res.status(400).send(e.message)
    }
  });
  app.post ("/api/v1/station", async function (req , res){
    try{
    const{stationname,stationtype,stationposition,stationstatus}= req.body;
    console.log(stationname)
    const newStation= {
      stationname: stationname,
       stationtype :"normal",
       stationposition : null,
       stationstatus : "new"
    }
   
    CreateStation = await db("se_project.stations").insert(newStation).returning("*")
      res.status(200).send(CreateStation)
    }
    catch(e){
      console.log(e.message);
      res.status(400).send(e.message)
    }

   });
   app.put("/api/v1/requests/senior/:requestId",async function(req,res){
    const requestId=req.params.requestId;
    const request=await db.select("*").from("se_project.senior_requests").where("id",requestId).first();
   if(isEmpty(request)){
      return res.status(404).send("request not found");
   }
   const {seniorStaus}=req.body;
    if(!seniorStaus){
      return res.status(400).send("senior status is required"); 
    }
    const newStatus = {
      status : req.body.seniorStaus
    }
    try{
      const request=await db("se_project.senior_requests").update(newStatus).where("id",requestId).returning("*");
      return res.status(200).json("updated senior status");
    }catch(e){
    console.log(e.message);
      return res.status(400).send("Could not update senior status");
   }
   });  
   app.put("/api/v1/zones/:zoneId", async function (req, res) {
  try {
    const { price } = req.body;

    // if (!Number.isInteger(price)) {
    //   throw new Error("Price must be an integer");
    // }

    const zoneId = req.params.zoneId;
    await db("se_project.zones").update("price", price).where("id", zoneId).returning("*");

    return res.status(200).json("Zone price updated successfully");
  } catch (e) {
    console.log(e.message);
    return res.status(400).send("Could not update zone price");
  }
});

// app.post("/api/v1/route", async function (req, res) {
//   try {
//     const { newStationId, connectTo, routeName } = req.body;

//     if (connectTo !== "start" && connectTo !== "end") {
//       throw new Error("Invalid connection position");
//     }

//     const existingRoute = await db("se_project.routes")
//       .where(connectTo === "start" ? "fromStationid" : "toStationid", newStationId)
//       .first();

//     if (existingRoute) {
//       throw new Error("Station already connected in the chosen position");
//     }

//     const newRoute = await db("se_project.routes").insert({
//       routename: routeName,
//       [connectTo === "start" ? "fromStationid" : "toStationid"]: newStationId,
//     });

//     return res.status(201).json({ routeId: newRoute[0] });
//   } catch (e) {
//     console.log(e.message);
//     return res.status(400).send("Could not create route");
//     }
//   });
}

