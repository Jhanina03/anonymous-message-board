'use strict';

const crypto = require('crypto');

// Base de datos en memoria: { 'general': [hilo1, hilo2, ...] }
// (Si el servidor se reinicia, los mensajes se borran. Para el reto es suficiente.)
const tableros = new Map();

function nuevoId() {
  return crypto.randomBytes(12).toString('hex'); // 24 caracteres, como un ObjectId de MongoDB
}

function obtenerTablero(nombre) {
  if (!tableros.has(nombre)) tableros.set(nombre, []);
  return tableros.get(nombre);
}

function buscarHilo(board, threadId) {
  return obtenerTablero(board).find(h => h._id === threadId);
}

// Quita los campos privados (reported y delete_password) antes de enviar al cliente
function respuestaPublica(r) {
  return { _id: r._id, text: r.text, created_on: r.created_on };
}
function hiloPublico(h, soloUltimas3) {
  const replies = soloUltimas3 ? h.replies.slice(-3) : h.replies;
  return {
    _id: h._id,
    text: h.text,
    created_on: h.created_on,
    bumped_on: h.bumped_on,
    replies: replies.map(respuestaPublica),
    replycount: h.replies.length
  };
}

// Toma un dato del body (formulario/JSON) o de la URL
function dato(req, campo) {
  return (req.body && req.body[campo]) || req.query[campo];
}

// Si viene de un formulario del navegador, redirige; si no, responde JSON
function quiereHtml(req) {
  return (req.get('accept') || '').includes('text/html');
}

module.exports = function (app) {

  app.route('/api/threads/:board')

    // Crear un hilo
    .post(function (req, res) {
      const board = req.params.board;
      const text = dato(req, 'text');
      const delete_password = dato(req, 'delete_password');
      if (!text || !delete_password) return res.send('missing required fields');

      const ahora = new Date();
      const hilo = {
        _id: nuevoId(),
        text,
        created_on: ahora,
        bumped_on: ahora,
        reported: false,
        delete_password,
        replies: []
      };
      obtenerTablero(board).push(hilo);

      if (quiereHtml(req)) return res.redirect('/b/' + board + '/');
      return res.json(hiloPublico(hilo, false));
    })

    // Ver los 10 hilos mas recientes con sus 3 ultimas respuestas
    .get(function (req, res) {
      const hilos = obtenerTablero(req.params.board)
        .slice()
        .sort((a, b) => b.bumped_on - a.bumped_on)
        .slice(0, 10)
        .map(h => hiloPublico(h, true));
      res.json(hilos);
    })

    // Reportar un hilo
    .put(function (req, res) {
      const hilo = buscarHilo(req.params.board, dato(req, 'thread_id') || dato(req, 'report_id'));
      if (!hilo) return res.send('thread not found');
      hilo.reported = true;
      res.send('reported');
    })

    // Borrar un hilo
    .delete(function (req, res) {
      const lista = obtenerTablero(req.params.board);
      const indice = lista.findIndex(h => h._id === dato(req, 'thread_id'));
      if (indice === -1) return res.send('thread not found');
      if (lista[indice].delete_password !== dato(req, 'delete_password')) {
        return res.send('incorrect password');
      }
      lista.splice(indice, 1);
      res.send('success');
    });

  app.route('/api/replies/:board')

    // Crear una respuesta
    .post(function (req, res) {
      const board = req.params.board;
      const threadId = dato(req, 'thread_id');
      const text = dato(req, 'text');
      const delete_password = dato(req, 'delete_password');
      const hilo = buscarHilo(board, threadId);
      if (!hilo) return res.send('thread not found');
      if (!text || !delete_password) return res.send('missing required fields');

      const ahora = new Date();
      const respuesta = {
        _id: nuevoId(),
        text,
        created_on: ahora,
        delete_password,
        reported: false
      };
      hilo.replies.push(respuesta);
      hilo.bumped_on = ahora; // el hilo "sube" con la nueva respuesta

      if (quiereHtml(req)) return res.redirect('/b/' + board + '/' + threadId);
      return res.json(hiloPublico(hilo, false));
    })

    // Ver un hilo con todas sus respuestas
    .get(function (req, res) {
      const hilo = buscarHilo(req.params.board, req.query.thread_id);
      if (!hilo) return res.send('thread not found');
      res.json(hiloPublico(hilo, false));
    })

    // Reportar una respuesta
    .put(function (req, res) {
      const hilo = buscarHilo(req.params.board, dato(req, 'thread_id'));
      if (!hilo) return res.send('thread not found');
      const respuesta = hilo.replies.find(r => r._id === dato(req, 'reply_id'));
      if (!respuesta) return res.send('reply not found');
      respuesta.reported = true;
      res.send('reported');
    })

    // Borrar una respuesta (su texto cambia a [deleted])
    .delete(function (req, res) {
      const hilo = buscarHilo(req.params.board, dato(req, 'thread_id'));
      if (!hilo) return res.send('thread not found');
      const respuesta = hilo.replies.find(r => r._id === dato(req, 'reply_id'));
      if (!respuesta) return res.send('reply not found');
      if (respuesta.delete_password !== dato(req, 'delete_password')) {
        return res.send('incorrect password');
      }
      respuesta.text = '[deleted]';
      res.send('success');
    });

};
