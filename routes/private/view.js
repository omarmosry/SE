const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userid', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleid', 'se_project.roles.id')
    .first();
  
  console.log('user =>', user)
  user.isStudent = user.roleid === roles.student;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;

  return user;  
}

module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function(req, res) {
    const users = await db.select('*').from('se_project.users');
    return res.render('users', { users });
  });

  // Register HTTP endpoint to render /courses page
  app.get('/stations_example', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');


    return res.render('stations_example', { ...user, stations });
  });

  app.get('/users/add', async function(req, res) {
    return res.render('add-user', {});
  });
  app.get('/users/edit/:id', async function(req, res) {
    const { id } = req.params;
    const user = await db.select('*')
    .from('se_project.users').where("id", id).first();
    return res.render('edit-user', { ...user });
  });

  app.get("/password/reset", async function (req, res) {
    const{newPassword}= req.params;
    const user = await db. select('*').from("se_project.users").where('id', req.userid).update('password', newPassword)
    console.log()
    return res.render('resetPass', { ...user });
  });
   app.get ("/api/v1/payment/ticket", async function (req, res){
    const {purchasedId, creditCardNumber, holderName, amount, origin, destination,tripDate}= req.body;
    const ticket = await db.select('*').from("se_project.ticket").where('id', req.params)
    return res.render('resetPass', { ...user });
   


   });
   app.get('/manage/zones', async function(req, res) {
    const zones = await db.select('*').from('se_project.zones');
    return res.render('manage-zones', { zones });
  });
};



