var testutils = require('./testutils');
var request = require('supertest-as-promised');
var assert = require('assert');
var should = require('chai').should();
var server = require('../app/app')();

var RecoveryRequest = require('../app/models/recoveryrequest');

describe('Application Server', function() {
  var agent;
  before(function() {
    agent = request.agent(server);
    return testutils.clearDatabaseQ();
  });

  describe('GET /', function() {
    it('should return the name', function() {
      return agent
      .get('/')
      .then(function(res) {
        res.status.should.eql(200);
        res.body.name.should.equal(process.config.name);
      });
    });
  });
  
  describe('Provision new key', function() {
    it('no useruserEmail specified', function() {
      return agent
      .post('/key')
      .then(function(res) {
        res.status.should.eql(400);
      });
    });
    it('should return a new key', function() {
      return agent
      .post('/key')
      .send({userEmail: 'test@example.com'})
      .then(function(res) {
        res.status.should.eql(200);
        should.exist(res.body.path);
        res.body.path.substr(0, 2).should.equal('m/');
        should.exist(res.body.xpub);
        res.body.xpub.substr(0, 4).should.equal('xpub');
        res.body.userEmail.should.equal('test@example.com');
      });
    });
  });

  describe('Validate key', function() {
    var path;
    var xpub;
    var userEmail;

    before(function() {
      return agent
      .post('/key')
      .send({userEmail: 'test@example.com'})
      .then(function(res) {
        res.status.should.eql(200);
        path = res.body.path;
        xpub = res.body.xpub;
        userEmail = res.body.userEmail;
      });
    });

    it('invalid: user specified but not xpub', function() {
      return agent
      .get('/key/')
      .query({ userEmail: userEmail })
      .then(function(res) {
        res.status.should.not.eql(200);
      });
    });

    it('should validate the xpub after creating it', function() {
      return agent
      .get('/key/' + xpub)
      .query({ userEmail: userEmail })
      .then(function(res) {
        res.status.should.eql(200);

        res.body.path.should.eql(path);
        res.body.xpub.should.eql(xpub);
        res.body.userEmail.should.eql(userEmail);
      });
    });

    it('should not validate the xpub with incorrect userEmail', function() {
      return agent
      .get('/key/' + xpub)
      .query({ userEmail: 'otherEmail@mail.com' })
      .then(function(res) {
        res.status.should.eql(404);
      });
    });

    it('should not validate the xpub with incorrect xpub', function() {
      return agent
      .get('/key/xpub6J3LqcP2o8s2QhczVUUUWVKgRJpH594zeLt4AZ3Uvy5t73rtvKeEkhmUY4cauXbmHreNMGXbR6QRYZeqs1U77j4cmaW5JQa1zpEKdS9Uivn')
      .query({ userEmail: userEmail })
      .then(function(res) {
        res.status.should.eql(404);
      });
    });
  });

  describe('Request recovery', function() {
    var path;
    var xpub;
    var userEmail;

    before(function() {
      return agent
      .post('/key')
      .send({userEmail: 'test@example.com'})
      .then(function(res) {
        res.status.should.eql(200);
        path = res.body.path;
        xpub = res.body.xpub;
        userEmail = res.body.userEmail;
      });
    });

    it('success: recovery request stored in db', function() {
      var transactionHex = "010000000176f1169fc7252d173b539b72be897408348ff37d72c236424e4026e057bc9cf60000000000ffffffff01607be660190000001976a914dbb0c5b54a9347cb1ee82dbded41e2302ad5360488ac00000000";
      return agent
      .post('/recover')
      .send(
        {
          userEmail: userEmail,
          xpub: xpub,
          transactionHex: transactionHex,
          inputs: [{
            "chainPath": "/0/1645",
            "redeemScript": "522103cdfebbd122a9fa9ba405efead022b24055273a12bffd7e5af1fc6e5bfdbe8dd32102688027f13b00377ae19da43f3474f598ade81b967a365d3ee7d34867f2eba5732102c12f3d5579458b8d8a08fcfd0f47c0b8c1dffe29fcc20fc84f33ef02e28c39a353ae"
          },
          {},
          {
            "chainPath": "/0/8397",
            "redeemScript": "522103147f08b4017d5207470aee49d888cf2a7ae49306a916147475378ebd2dab661d21029f6ad03f8933b8b83ca54246fc47f0e7d41dccac9629e0602433cee2c02f664421026b432d8b41d81338a6b3c4fd4a492cd0b9485a97deb7f68502176b03c6bb17de53ae"
          }],
          "custom": { "message" : "need help!" }
        }
      )
      .then(function(res) {
        res.status.should.eql(200);
        res.body.should.have.property('created');
        res.body.should.have.property('id');
        res.body.id.should.not.eql('');
        return RecoveryRequest.findOneQ({_id: res.body.id});
      })
      .then(function(res) {
        assert(res);
        res.userEmail.should.eql(userEmail);
        res.xpub.should.eql(xpub);
        res.transactionHex.should.eql(transactionHex);
        res.inputs.length.should.eql(3);
        res.inputs[0].chainPath.should.eql("/0/1645");
        res.custom.message.should.contain('help');
      });
    });
  });
});
