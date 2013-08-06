var util = require('util'),
  express = require('express'),
  googleapis = require('googleapis'),
  settings = {
    server: {
      hostname: 'mktgdept.com',
      port: '5555'
    },
    google: {
      client_id: '000000000000.apps.googleusercontent.com',
      client_secret: 'bbbbbbbbbbbbbbbbbbbbbbbb'
    }
  },
  numberFormat = function(num) {
    var parts = num.toString().split('.');
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (parts[1] ? '.' + parts[1] : '');
  },
  template = function(property) {
    return '<article><section><table class="text-auto-size"><tbody><tr><td>New Visitors</td><td class="align-right">' + numberFormat(property.visitors.new) + '</td></tr><tr><td>Returning Visitors</td><td class="align-right">' + numberFormat(property.visitors.returning) + '</td></tr></tbody></table></section><footer><p class="' + (property.active ? 'green' : 'red') + '">' + property.name + '</p></footer></article>';
  },
  OAuth2Client = googleapis.OAuth2Client,
  oauth2Client,
  properties = {},
  app = express(),
  addCard = function(webPropertyId) {
    googleapis.discover('mirror', 'v1').discover('analytics', 'v3').execute(function(err, client) {
      client.analytics.management.profiles.list({ accountId: webPropertyId.match(/UA\-(\d+)\-\d+/)[1], webPropertyId: webPropertyId }).withAuthClient(oauth2Client).execute(function(err, results) {
        console.log('client.analytics.management.profiles.list', util.inspect(results));
        properties[webPropertyId] = {
          id: results.items[0].id,
          name: results.items[0].name,
          visitors: {
            new: 0,
            returning: 0
          },
          active: false
        };
        client.analytics.data.realtime.get({ ids: 'ga:' + properties[webPropertyId].id, metrics: 'ga:activeVisitors', dimensions: 'ga:visitorType' }).withAuthClient(oauth2Client).execute(function(err, result) {
          properties[webPropertyId].visitors[result.rows[0][0].toLowerCase()] = result.rows[0][1];
          if(result.rows[1])
            properties[webPropertyId].visitors[result.rows[1][0].toLowerCase()] = result.rows[1][1];
          client.mirror.timeline.insert({
            sourceItemId: webPropertyId,
            html: template(properties[webPropertyId]),
            menuItems: [
              {
                id: 'start',
                action: 'CUSTOM',
                values: [
                  {
                    displayName: 'Start',
                    iconUrl: 'http://' + settings.server.hostname + ':' + settings.server.port + '/resume.png'
                  }
                ]
              },
              {
                action: 'TOGGLE_PINNED'
              },
              {
                action: 'DELETE'
              }
            ]
          }).withAuthClient(oauth2Client).execute(function(err, result) {
            console.log('mirror.timeline.insert', util.inspect(result));
          });
        });
      });
    });
  },
  startUpdating = function(card) {
    properties[card.sourceItemId].active = true;
    updateProperty(card, true);
    properties[card.sourceItemId].interval = setInterval(function() {
      updateProperty(card);
    }, 10000);
    properties[card.sourceItemId].timeout = setTimeout(function() {
      stopUpdating(card);
    }, 300000);
  },
  updateProperty = function(card, force) {
    googleapis.discover('mirror', 'v1').discover('analytics', 'v3').execute(function(err, client) {
      client.analytics.data.realtime.get({ ids: 'ga:' + properties[card.sourceItemId].id, metrics: 'ga:activeVisitors', dimensions: 'ga:visitorType' }).withAuthClient(oauth2Client).execute(function(err, result) {
        var data = {
          new: 0,
          returning: 0
        };
        data[result.rows[0][0].toLowerCase()] = result.rows[0][1];
        if(result.rows[1])
          data[result.rows[1][0].toLowerCase()] = result.rows[1][1];
        if(force || data.new != properties[card.sourceItemId].visitors.new || data.returning != properties[card.sourceItemId].visitors.returning) {
          properties[card.sourceItemId].visitors = data;
          client.mirror.timeline.patch({
            id: card.id
          }, {
            html: template(properties[card.sourceItemId]),
            menuItems: properties[card.sourceItemId].active ? [
                {
                  id: 'pause',
                  action: 'CUSTOM',
                  values: [
                    {
                      displayName: 'Pause',
                      iconUrl: 'http://' + settings.server.hostname + ':' + settings.server.port + '/pause.png'
                    }
                  ]
                },
                {
                  action: 'TOGGLE_PINNED'
                }
              ] : [
                {
                  id: 'start',
                  action: 'CUSTOM',
                  values: [
                    {
                      displayName: 'Start',
                      iconUrl: 'http://' + settings.server.hostname + ':' + settings.server.port + '/resume.png'
                    }
                  ]
                },
                {
                  action: 'TOGGLE_PINNED'
                },
                {
                  action: 'DELETE'
                }
              ]
          }).withAuthClient(oauth2Client).execute(function(err, result) {
            console.log('mirror.timeline.patch', util.inspect(result));
          });
        }
      });
    });
  },
  stopUpdating = function(card) {
    properties[card.sourceItemId].active = false;
    clearInterval(properties[card.sourceItemId].interval);
    clearTimeout(properties[card.sourceItemId].timeout);
    updateProperty(card, true);
  };

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.static(__dirname + '/public'));
});

app.get('/', function(req, res) {
  if(!oauth2Client || !oauth2Client.credentials) {
    oauth2Client = new OAuth2Client(settings.google.client_id, settings.google.client_secret, 'http://' + settings.server.hostname + ':' + settings.server.port + '/oauth2callback');
    res.redirect(oauth2Client.generateAuthUrl({
      access_type: 'offline',
      approval_prompt: 'force',
      scope: [
        'https://www.googleapis.com/auth/glass.timeline',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/analytics.readonly'
      ].join(' ')
    }));
  }
  else {
    googleapis.discover('mirror', 'v1').execute(function(err, client) {
      client.mirror.withAuthClient(oauth2Client).newRequest('mirror.subscriptions.insert', null, {
        callbackUrl: 'https://mirrornotifications.appspot.com/forward?url=http://' + settings.server.hostname + ':' + settings.server.port + '/subcallback',
        collection: 'timeline'
      }).execute(function(err, result) {
        console.log('mirror.subscriptions.insert', util.inspect(result));
      });
      addCard('UA-XXXXX-X'); // add your site's ID here
    });
    res.send(200);
  }
});

app.get('/oauth2callback', function(req, res) {
  if(!oauth2Client) {
    res.redirect('/');
  }
  else {
    oauth2Client.getToken(req.query.code, function(err, tokens) {
      oauth2Client.credentials = tokens;
      res.redirect('/');
    });
  }
});

app.post('/subcallback', function(req, res) {
  res.send(200);
  console.log('/subcallback', util.inspect(req.body));
  if(req.body.operation == 'UPDATE' && req.body.userActions && req.body.userActions[0].type == 'CUSTOM') {
    googleapis.discover('mirror', 'v1').execute(function(err, client) {
      client.mirror.timeline.get({ id: req.body.itemId }).withAuthClient(oauth2Client).execute(function(err, result) {
        console.log('mirror.timeline.get', util.inspect(result));
        switch(req.body.userActions[0].payload) {
          case 'start':
            startUpdating(result);
            break;
          case 'pause':
            stopUpdating(result);
        }
      });
    });
  }
});

app.get('/track/:id', function(req, res) {
  res.send(200);
  addCard(req.params.id);
});

app.listen(settings.server.port);