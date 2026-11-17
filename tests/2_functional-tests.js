const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
  const board = 'pruebas';
  let threadId;       // hilo que se usa para respuestas
  let threadIdBorrar; // hilo que se borra
  let replyId;

  test('Creating a new thread: POST request to /api/threads/{board}', function(done) {
    chai.request(server)
      .post('/api/threads/' + board)
      .send({ text: 'Hilo de prueba', delete_password: 'clave123' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.body.text, 'Hilo de prueba');
        assert.property(res.body, '_id');
        assert.property(res.body, 'created_on');
        assert.equal(res.body.bumped_on, res.body.created_on);
        assert.isArray(res.body.replies);
        threadId = res.body._id;
        // un segundo hilo para probar el borrado
        chai.request(server)
          .post('/api/threads/' + board)
          .send({ text: 'Hilo para borrar', delete_password: 'borrar' })
          .end(function(err2, res2) {
            threadIdBorrar = res2.body._id;
            done();
          });
      });
  });

  test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function(done) {
    chai.request(server)
      .get('/api/threads/' + board)
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.isAtMost(res.body.length, 10);
        res.body.forEach(h => {
          assert.isAtMost(h.replies.length, 3);
          assert.notProperty(h, 'reported');
          assert.notProperty(h, 'delete_password');
        });
        done();
      });
  });

  test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', function(done) {
    chai.request(server)
      .delete('/api/threads/' + board)
      .send({ thread_id: threadIdBorrar, delete_password: 'incorrecta' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', function(done) {
    chai.request(server)
      .delete('/api/threads/' + board)
      .send({ thread_id: threadIdBorrar, delete_password: 'borrar' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'success');
        done();
      });
  });

  test('Reporting a thread: PUT request to /api/threads/{board}', function(done) {
    chai.request(server)
      .put('/api/threads/' + board)
      .send({ thread_id: threadId })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'reported');
        done();
      });
  });

  test('Creating a new reply: POST request to /api/replies/{board}', function(done) {
    chai.request(server)
      .post('/api/replies/' + board)
      .send({ thread_id: threadId, text: 'Respuesta de prueba', delete_password: 'resp123' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        const ultima = res.body.replies[res.body.replies.length - 1];
        assert.equal(ultima.text, 'Respuesta de prueba');
        assert.equal(res.body.bumped_on, ultima.created_on);
        replyId = ultima._id;
        done();
      });
  });

  test('Viewing a single thread with all replies: GET request to /api/replies/{board}', function(done) {
    chai.request(server)
      .get('/api/replies/' + board)
      .query({ thread_id: threadId })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.body._id, threadId);
        assert.isArray(res.body.replies);
        assert.notProperty(res.body, 'reported');
        assert.notProperty(res.body, 'delete_password');
        res.body.replies.forEach(r => {
          assert.notProperty(r, 'reported');
          assert.notProperty(r, 'delete_password');
        });
        done();
      });
  });

  test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', function(done) {
    chai.request(server)
      .delete('/api/replies/' + board)
      .send({ thread_id: threadId, reply_id: replyId, delete_password: 'incorrecta' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'incorrect password');
        done();
      });
  });

  test('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', function(done) {
    chai.request(server)
      .delete('/api/replies/' + board)
      .send({ thread_id: threadId, reply_id: replyId, delete_password: 'resp123' })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'success');
        done();
      });
  });

  test('Reporting a reply: PUT request to /api/replies/{board}', function(done) {
    chai.request(server)
      .put('/api/replies/' + board)
      .send({ thread_id: threadId, reply_id: replyId })
      .end(function(err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, 'reported');
        done();
      });
  });
});
