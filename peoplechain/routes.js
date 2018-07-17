var peoplechain = require('./controller.js');

module.exports = function(app) {
  app.get('/get_all_record', function(req, res){
    peoplechain.get_all_record(req, res);
  });

  app.get('/generate_key/:user', function(req, res){
    peoplechain.generate_key(req, res);
  });

  app.get('/create_record/:record', function(req, res){
    peoplechain.create_record(req, res);
  });

  app.get('/get_record/:id', function(req, res){
    peoplechain.get_record(req, res);
  });

  app.get('/grant_access/:details', function(req, res){
    peoplechain.grant_access(req, res);
  });

  app.get('/decline_access/:details', function(req, res){
    peoplechain.decline_access(req, res);
  });

}
