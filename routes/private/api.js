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

  if (noOfStations < 10) {
    return noOfStations * 5
  } else if (noOfStations < 17) {
    return noOfStations * 7
  } else {
    return noOfStations * 10
  }
}

module.exports = function (app) {
  // example
  app.post("/api/v1/user", async function (req, res) {

    // Check if user already exists in the system
    const userExists = await db
      .select("*")
      .from("se_project.users")
      .where("email", req.body.email);
    if (!isEmpty(userExists)) {
      return res.status(400).send("user exists");
    }

    const newUser = {
      firstname: req.body.firstName,
      lastname: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      roleid: roles.user,
    };
    try {
      console.log(newUser);
      const user = await db("se_project.users").insert(newUser).returning("*");

      return res.status(200).json(user);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not register user");
    }
  });
  
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

  app.put("/api/v1/requests/refunds/:requestId", async function (req, res) {

    // check for authenticity since only the admin can accept and reject requests

    const user = await getUser(req);
    if (!user.isAdmin) {
      return res.status(401).send("Unauthorized");
    }
    // after authenticity check, admin can now view the request
    const requestId = req.params.requestId;
    const request = await db.select("*").from("se_project.refund_requests").where("id", requestId).first();
    if (isEmpty(request)) {
      return res.status(404).send("request not found");
    }

    //validate if the ticket is valid
    const ticketId = request.ticketid;
    const ticket = await db.select("*").from("se_project.tickets").where("id", ticketId).first();
    if (isEmpty(ticket)) {
      return res.status(404).send("ticket not found");
    }
    //validate if the ticket belongs to the user


    //admin can now accept or reject the request
    const {
      refundstatus
    } = req.body;
    if (!refundstatus) {
      return res.status(400).send("refund status is required"); //in case admin forgets to add the refund status
    }

    const newStatus = {
      status: req.body.refundstatus
    }

    try {
      const request = await db("se_project.refund_requests").update(newStatus).where("id", requestId).returning("*");


      return res.status(200).json("updated refund status");

    } catch (e) {
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
  app.post("/api/v1/payment/ticket", async function (req, res) {
    const {
      purchasedId,
      creditCardNumber,
      holderName,
      amount,
      origin,
      destination,
      tripDate
    } = req.body;
    const subs = await db.select(["subtype", "nooftickets"]).from("se_project.subsription").where('userid', req.userid)

    let ticket = null;
    console.log(subs);
    if (subs.length === 0) {
      console.log("innn");
      await db("se_project.transactions").insert({
        purchasediid: purchasedId,
        amount: amount,
        userid: req.userid
      })
      ticket = await db("se_project.tickets").insert({
        origin: origin,
        destination: destination,
        userid: req.userid,
        tripdate: tripDate
      }).returning("*")
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

    res.status(200).send({
      ticket
    })
  })
  app.post("/api/v1/senior/request", async function (req, res) {
    const {
      nationalId
    } = req.body;
    console.log(nationalId);
    const Rstatus = "pending"
    SenReq = await db("se_project.senior_requests").insert({
      status: Rstatus,
      userid: req.userid,
      nationalid: nationalId
    }).returning("*")
    res.status(200).send({
      SenReq
    })
  });
  app.put("/api/v1/route/:routeId", async function (req, res) {
    try {
      const {
        routeName
      } = req.body;
      console.log(routeName)
      UpRoute = await db('se_project.routes').update({
        routename: routeName
      }).where('id', req.params.routeId).returning("*")
      res.status(200).send({
        UpRoute
      })
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message)
    }
  });
  app.put("/api/v1/station/:stationId", async function (req, res) {
    try {
      const {
        stationName
      } = req.body;
      console.log(stationName)
      UpdateStation = await db("se_project.stations").update({
        stationname: stationName
      }).where('id', req.params.stationId).returning("*")
      res.status(200).send({
        UpdateStation
      })
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message)
    }
  });
  app.post("/api/v1/station", async function (req, res) {
    try {
      const {
        stationname,
        stationtype,
        stationposition,
        stationstatus
      } = req.body;
      console.log(stationname)
      const newStation = {
        stationname: stationname,
        stationtype: "normal",
        stationposition: null,
        stationstatus: "new"
      }

      CreateStation = await db("se_project.stations").insert(newStation).returning("*")
      res.status(200).send(CreateStation)
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message)
    }

  });
  app.put("/api/v1/requests/senior/:requestId", async function (req, res) {
    const requestId = req.params.requestId;
    const request = await db.select("*").from("se_project.senior_requests").where("id", requestId).first();
    if (isEmpty(request)) {
      return res.status(404).send("request not found");
    }
    const {
      seniorStaus
    } = req.body;
    if (!seniorStaus) {
      return res.status(400).send("senior status is required");
    }
    const newStatus = {
      status: req.body.seniorStaus
    }
    try {
      const request = await db("se_project.senior_requests").update(newStatus).where("id", requestId).returning("*");
      return res.status(200).json("updated senior status");
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not update senior status");
    }
  });
  app.put("/api/v1/zones/:zoneId", async function (req, res) {
    try {
      const {
        price
      } = req.body;

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


  app.post('/api/v1/payment/subscription', async function (req, res) {
    console.log('Received payment request:', req.body);
    try {
      const {
        purchasedId,
        creditCardNumber,
        holderName,
        amount,
        subtype,
        zoneid
      } = req.body;

      // Validate the request data
      if (!purchasedId || !creditCardNumber || !holderName || !amount || !subtype || !zoneid) {
        throw new Error('Missing required fields');
      }

      const userid = req.userid;
      console.log('User ID:', userid);

      const existingSubscription = await db.select('*').from('se_project.subscription').where({
        userid: userid,
        subtype: subtype
      }).first();
      console.log('Existing subscription:', existingSubscription);

      if (existingSubscription) {
        throw new Error('User already has a subscription of this type');
      }

      let numTickets;
      switch (subtype) {
        case 'annual':
          numTickets = 100;
          break;
        case 'quarterly':
          numTickets = 50;
          break;
        case 'monthly':
          numTickets = 10;
          break;
        default:
          throw new Error('Invalid subscription type');
      }

      const client = await db.transaction();
      console.log('Starting transaction');
      try {
        const transaction = {
          amount: amount,
          userid: purchasedId,
          purchasediid: creditCardNumber
        };
        const newTransaction = await client.insert(transaction).into('se_project.transactions').returning('id');
        console.log('New transaction:', newTransaction);

        const subscription = {
          userid: purchasedId,
          subtype: subtype,
          zoneid: zoneid,
          nooftickets: numTickets,
        };
        const newSubscription = await client.insert(subscription).into('se_project.subscription').returning('id');
        console.log('New subscription:', newSubscription);

        await client.commit();

        return res.status(200).json({
          transactionId: newTransaction[0],
          subscriptionId: newSubscription[0],
          numTickets
        });
      } catch (e) {
        await client.rollback();
        console.log(e.message);
        return res.status(400).json({
          message: 'Could not complete payment'
        });
      } finally {
        await client.destroy();
      }
    } catch (e) {
      console.log(e.message);
      return res.status(400).json({
        message: 'Could not complete payment'
      });
    }
  });
  app.post('/api/v1/tickets/purchase/subscription', async (req, res) => {
    try {
      console.log('Received request to purchase ticket with subscription');

      // Validate input data
      const {
        subId,
        origin,
        destination,
        tripDate
      } = req.body;
      if (!subId || !origin || !destination || !tripDate) {
        console.log('Missing required fields');
        return res.status(400).json({
          message: 'Missing required fields'
        });
      }
      const userid = req.userid;
      if (!userid) {
        console.log('User is not authenticated');
        return res.status(401).json({
          message: 'User is not authenticated'
        });
      }
      console.log(`User ID: ${userid}, Subscription ID: ${subId}, Origin: ${origin}, Destination: ${destination}, Trip Date: ${tripDate}`);

      // Check if trip date is in the future
      const today = new Date();
      const tripDateObj = new Date(tripDate);
      if (tripDateObj < today) {
        console.log('Trip date is in the past');
        return res.status(400).json({
          message: 'Trip date is in the past'
        });
      }

      // Check if subscription exists
      const subscription = await db.select('*').from('se_project.subscription').where({
        id: subId,
        userid
      }).first();
      if (!subscription) {
        console.log('Invalid subscription ID');
        return res.status(400).json({
          message: 'Invalid subscription ID'
        });
      }

      console.log(`Subscription: ${JSON.stringify(subscription)}`);

      // Check if subscription has available tickets
      if (subscription.nooftickets < 1) {
        console.log('No available tickets on subscription');
        return res.status(400).json({
          message: 'No available tickets on subscription'
        });
      }

      // Get fare zone data based on subscription zone ID
      const zone = await db.select('*').from('se_project.zones').where({
        id: subscription.zoneid
      }).first();
      if (!zone) {
        console.log(`Fare zone not found for zone ID ${subscription.zoneid}`);
        return res.status(500).json({
          message: 'Server error'
        });
      }

      console.log(`Fare zone: ${JSON.stringify(zone)}`);

      // Calculate ticket price based on fare zone price and subscription type
      let ticketPrice;
      if (subscription.subtype === 'monthly') {
        ticketPrice = zone.price * 0.8; // 20% discount for monthly subscriptions
      } else if (subscription.subtype === 'quarterly') {
        ticketPrice = zone.price * 0.7; // 30% discount for quarterly subscriptions
      } else if (subscription.subtype === 'annual') {
        ticketPrice = zone.price * 0.6; // 40% discount for annual subscriptions
      } else {
        console.log('Invalid subscription type');
        return res.status(400).json({
          message: 'Invalid subscription type'
        });
      }

      console.log(`Ticket price: ${ticketPrice}`);

      // Create new ticket with calculated price and provided data
      const ticket = {
        origin,
        destination,
        userid,
        subid: subId,
        tripdate: tripDate,
        price: ticketPrice,
      };
      const [newTicket] = await db.insert(ticket).into('se_project.tickets').returning('*');

      console.log(`New ticket: ${JSON.stringify(newTicket)}`);

      // Create new ride based on ticket data
      const ride = {
        status: 'upcoming',
        origin,
        destination,
        userid,
        ticketid: newTicket.id,
        tripdate: tripDate,
      };
      const [newRide] = await db.insert(ride).into('se_project.rides').returning('*');

      console.log(`New ride: ${JSON.stringify(newRide)}`);

      // Update subscription to decrement number of available tickets
      await db('se_project.subscription').where({
        id: subId
      }).decrement('nooftickets', 1);

      console.log('Ticket purchase successful');

      // Send response with ticket and ride data
      return res.status(200).json({
        ticket: newTicket,
        ride: newRide
      });
    } catch (error) {
      console.error(error);
      console.log('Server error');
      return res.status(500).json({
        message: 'Server error'
      });
    }
  });
  app.post('/api/v1/refund/:ticketId', async function (req, res) {
    console.log('Received ticket refund request:', req.params);

    try {
      // Get the ticket ID from the request parameters
      const ticketId = req.params.ticketId;
      console.log('Ticket ID:', ticketId);

      // Check if the user ID is present and has a valid value
      if (!req.user || !req.userid) {
        const message = 'User ID is missing or invalid';
        console.log('Error:', message);
        return res.status(400).json({
          message
        });
      }

      // Check if the ticket exists and belongs to the authenticated user
      const existingTicket = await db.select('*').from('se_project.tickets').where({
        id: ticketId,
        user_id: req.user.id
      }).first();
      console.log('Existing ticket:', existingTicket);
      if (!existingTicket) {
        const message = 'Ticket with given ID not found or does not belong to the authenticated user';
        console.log('Error:', message);
        return res.status(404).json({
          message
        });
      }

      // Check if the ticket is a future-dated ticket
      const tripDate = new Date(existingTicket.trip_date);
      if (tripDate < new Date()) {
        const message = 'Ticket is not a future-dated ticket';
        console.log('Error:', message);
        return res.status(400).json({
          message
        });
      }

      // Refund the ticket price based on payment method
      let refundAmount;
      let purchasedItemId;
      if (existingTicket.sub_id) {
        // Refund ticket paid by subscription
        const subscription = await db.select('*').from('se_project.subscriptions').where({
          id: existingTicket.sub_id
        }).first();
        const zone = await db.select('*').from('se_project.zones').where({
          id: subscription.zone_id
        }).first();
        const ticketPrice = zone.price / subscription.number_of_tickets;
        refundAmount = ticketPrice * existingTicket.quantity;
        purchasedItemId = `subscription ${existingTicket.sub_id}`;
        console.log('Refund amount for ticket paid by subscription:', refundAmount);
      } else {
        // Refund ticket paid online
        const transaction = await db.select('*').from('se_project.transactions').where({
          purchasediid: ticketId
        }).first();
        refundAmount = transaction.amount;
        purchasedItemId = `ticket ID: ${existingTicket.id}`;
        console.log('Refund amount for ticket paid online:', refundAmount);
      }

      // Delete the ticket from the database
      await db.delete().from('se_project.tickets').where({
        id: ticketId
      });
      console.log('Deleted ticket with ID:', ticketId);

      // Insert the refunded transaction into the database
      const transaction = {
        userid: req.user.id,
        amount: refundAmount,
        purchasediid: purchasedItemId
      };
      await db('se_project.transactions').insert(transaction);
      console.log('Inserted transaction for refunded purchase:', transaction);

      // Construct the response
      const response = {
        message: 'Ticket refunded successfully'
      };
      console.log('Response:', response);

      // Send the response
      res.status(200).json(response);
    } catch (error) {
      console.error(error);

      // Construct the error response
      const response = {
        message: 'Failed to refund ticket',
        error: error.message
      };
      console.log('Error response:', response);
      // Send the error response
      res.status(500).json(response);
    }
  });
  app.delete('/api/v1/route/:routeId', async function (req, res) {
    console.log('Received route delete request:', req.params);

    try {
      // Get the route ID from the request parameters
      const routeId = req.params.routeId;
      console.log('Route ID:', routeId);

      // Check if the route exists
      const existingRoute = await db.select('*').from('se_project.routes').where({
        id: routeId
      }).first();
      console.log('Existing route:', existingRoute);
      if (!existingRoute) {
        throw new Error('Route with given ID does not exist');
      }

      // Delete the route from the database
      await db.delete().from('se_project.routes').where({
        id: routeId
      });
      console.log('Route deleted successfully');

      // Check if the stations are still connected to any other routes
      const startStationId = existingRoute.fromstationid;
      const endStationId = existingRoute.tostationid;
      console.log('Start station ID:', startStationId); // Corrected variable name
      console.log('End station ID:', endStationId); // Corrected variable name

      const isStartStationConnected = await db.select('*').from('se_project.routes').where({
        fromstationid: startStationId
      }).first();
      console.log('Is start station connected:', isStartStationConnected);
      const isEndStationConnected = await db.select('*').from('se_project.routes').where({
        tostationid: endStationId
      }).first(); // Changed the column name to "tostationid"
      console.log('Is end station connected:', isEndStationConnected);

      // If the stations are not connected to any other routes, update their status and position
      if (!isStartStationConnected) {
        await db('se_project.stations').update({
          stationstatus: 'unconnected',
          stationposition: endStationId
        }).where({
          id: startStationId
        });
        console.log('Start station updated successfully');
      }
      if (!isEndStationConnected) {
        await db('se_project.stations').update({
          stationstatus: 'unconnected',
          stationposition: startStationId
        }).where({
          id: endStationId
        });
        console.log('End station updated successfully');
      }

      // Construct the response
      const response = {
        message: 'Route deleted successfully'
      };
      console.log('Response:', response);

      // Send the response
      res.status(200).json(response);
    } catch (error) {
      console.error(error);

      // Construct the error response
      const response = {
        message: 'Failed to delete route',
        error: error.message
      };
      console.log('Error response:', response);

      // Send the error response
      res.status(500).json(response);
    }
  });
  app.get('/api/v1/zones', async function (req, res) {
    try {
      const zones = await db.select('*').from('se_project.zones')

      return res.status(200).json({
        zones
      });
    } catch (e) {
      console.log(e);
      return res.status(400).send('Could not fetch zones');
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
    if (!station) {
      return res.status(400).send({
        message: 'No station with that ID'
      });
    }
    const {
      stationposition,
      stationtype
    } = station || {};

    if (stationposition === "middle") {
      if (stationtype === "transfer") {
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
