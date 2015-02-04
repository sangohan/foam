CLASS({
   "model_": "Model",
   "id": "com.google.mail.GMailMessageDAO",
   "package": "com.google.mail",
   "name": "GMailMessageDAO",
   "extendsModel": "com.google.mail.GMailRestDAO",
   "requires": [
      "com.google.mail.FOAMGMailMessage",
      "com.google.mail.GMailRestDAO",
      "com.google.mail.GMailDraft",
      "com.google.mail.GMailMessage",
      "com.google.mail.GMailHistory",
      "NullDAO",
      "com.google.mail.GMailHistory"
   ],
   "imports": [
      "ajsonp"
   ],
   "exports": [],
   "properties": [
      {
         "model_": "Property",
         "name": "daoListeners_",
         "hidden": true,
         "transient": true,
         "factory": function () { return []; }
      },
      {
         "model_": "ArrayProperty",
         "name": "paramProperties",
         "help": "Properties that are handled as separate parameters rather than in the query.",
         "subType": "Property"
      },
      {
         "model_": "IntProperty",
         "name": "batchSize",
         "defaultValue": 200
      },
      {
         "model_": "IntProperty",
         "name": "skipThreshold",
         "defaultValue": 1000
      },
      {
         "model_": "Property",
         "name": "url",
         "label": "REST API URL.",
         "defaultValue": "https://www.googleapis.com/gmail/v1/users"
      },
      {
         "model_": "Property",
         "name": "modelName",
         "defaultValueFn": function () { return this.model.plural; }
      },
      {
         "model_": "Property",
         "name": "xhr",
         "transient": true,
         "factory": function () { return this.X.XHR.create({ responseType: 'json' }); }
      },
      {
         "model_": "Property",
         "name": "model",
         "label": "Type of data stored in this DAO.",
         "hidden": true,
         "transient": true,
         "defaultValueFn": function () { return this.FOAMGMailMessage; }
      },
      {
         "model_": "Property",
         "name": "messageUrl",
         "defaultValueFn": function () { return this.url + '/me/messages'; }
      },
      {
         "model_": "Property",
         "name": "draftUrl",
         "defaultValueFn": function () { return this.url + '/me/drafts'; }
      },
      {
         "model_": "Property",
         "name": "draftDao",
         "hidden": true,
         "transient": true,
         "factory": function () { return this.GMailRestDAO.create({ model: this.GMailDraft }); }
      },
      {
         "model_": "Property",
         "name": "localDao",
         "hidden": true,
         "transient": true,
         "factory": function () { return this.NullDAO.create({ model: this.GMailMessage }); }
      },
      {
         "model_": "Property",
         "name": "historyDao",
         "hidden": true,
         "transient": true,
         "factory": function () { return this.GMailRestDAO.create({ model: this.GMailHistory }); }
      },
      {
         "model_": "IntProperty",
         "name": "pollingPeriod",
         "units": "ms",
         "defaultValue": 10000
      },
      {
         "model_": "BooleanProperty",
         "name": "syncing",
         "transient": true,
         "defaultValue": false
      },
      {
         "model_": "IntProperty",
         "name": "lastClientVersion"
      },
      {
         "model_": "Property",
         "name": "ajsonp",
         "hidden": true,
         "transient": true
      }
   ],
   "actions": [],
   "constants": [],
   "messages": [],
   "methods": [
      {
         "model_": "Method",
         "name": "listen",
         "code": function (l, options) {
      this.SUPER(l, options);
      if ( this.daoListeners_.length === 1 ) {
        this.startSync();
      }
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "unlisten",
         "code": function (l) {
      this.SUPER(l);
      if ( this.daoListeners_.length === 0 ) {
        this.stopSync();
      }
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "doSync",
         "code": function (ret) {
      var self = this;
      this.historyDao
        .where(GT(this.GMailHistory.ID, self.lastHistoryId))
        .select({
          put: function(item) {
            self.lastHistoryId = item.id;
            for ( var i = 0, msg; msg = item.messages[i]; i++ ) {
              self.find(msg.id, {
                put: function(obj) {
                  self.notify_('put', [obj]);
                },
                error: function(_, status) {
                  if ( status === 404 ) {
                    // TODO: Don't be so specific, distinguish between network error versus object not found error?
                    var obj = self.jsonToObj(msg);
                    self.notify_('remove', [obj]);
                    return;
                  }
                  // TODO: Handle failing to fetch a message that should be there.
                }
              });
            }
          },
          error: function() {
            ret();
          },
          eof: function() {
            ret();
          }
        });
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "startSync",
         "code": function () {
      var self = this;
      if ( this.syncing ) return;
      aseq(
        function(ret) {
          self.syncing = true;
          if ( ! self.lastHistoryId ) {
            self.limit(1).select()(function(msgs) {
              if ( ! msgs || msgs.length === 0 ) {
                // Auto restart sync every 60 seconds.
                self.X.setTimeout(self.startSync.bind(self), 60000);
                return;
              }
              self.lastHistoryId = msgs[0].historyId;
              ret();
            });
            return;
          }
          ret();
        },
        awhile(
          function() { return self.syncing; },
          aseq(
            function(ret) {
              self.doSync(ret);
            },
            function(ret) {
              self.X.setTimeout(ret, self.pollingPeriod);
            })))(function(){});
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "stopSync",
         "code": function () {
      this.syncing = false;
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "postProcessObject",
         "code": function (ret, error, obj) {
      var self = this;
      var earlyOut = ret;

      if ( ! obj.payload ) {
        this.find(obj.id, {
          put: function(o) {
            ret(o);
          },
          error: function() {
            error('Failed to find object.');
            ret(null);
          }
        });
        return;
      }

      // TODO: Hack to detect chat messages and skip them until
      // the API is fixed not to include them or to mark them appropriately
      // The GMail API returns chat messages as messages with no labels
      // or timestamp.
      if ( obj.payload.headers.length === 1 &&
           obj.payload.headers[0].name === "From" ) {
        obj.labelIds = ['CHAT', obj.labelIds];
        ret(obj.labelIds);
        return;
      }

      aseq(
        aif(function() { return ( obj.labelIds.indexOf('DRAFT') != -1 &&
                                  obj.id.indexOf('draft_') != 0 ); },
            aseq(
              function(ret) {
                self.setDraftId_(ret, obj);
              },
              function(ret, success) {
                if ( ! success ) {
                  error('Could not find matching draft for ' + obj.id);
                  earlyOut(null);
                  return;
                }
                ret();
              })),
        function(ret) {
          ret(obj);
        })(ret);
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "onSelectData",
         "code": function (ret, data, sink, fc) {
      if ( ! sink || ! sink.put ) { ret(); return; }

      var self = this;
      var obj;
      var earlyOut = ret;
      var tmp;
      aseq(
        function(ret) {
          self.postProcessObject(ret, fc.error.bind(fc), data);
        },
        function(ret, o) {
          // Skip chats, since they don't have timestamps and as such are pretty useless.
          if ( o.labelIds[0] === 'CHAT' ) {
            ret();
            return;
          }

          if ( ! fc.errorEvt ) sink.put(o, null, fc);
          ret();
        })(ret);
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "setDraftId_",
         "code": function (ret, obj) {
      var self = this;
      self.draftDao.where(EQ({partialEval: function() { return this }, f: function(o) { return o.message.id; }}, obj.id)).limit(1).select()(function(drafts) {
        if ( drafts.length === 0 ) {
          ret(false);
          return;
        }

        obj.messageId = drafts[0].message.id;
        obj.draftId = drafts[0].id;
        obj.id = ( obj.getHeader(obj.FOAM_MESSAGEID_HEADER) ||
                   'draft_' + obj.draftId );
        ret(true);
      });
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "sendDraft_",
         "code": function (ret, draftId, obj, sink) {
      var self = this;
      if ( obj.deleted ) {
        ret();
        return;
      }

      aseq(
        function(ret) {
          self.xhr.asend(ret, self.draftUrl + '/send',
                         JSON.stringify({ id: draftId }),
                         "POST");
        },
        function(ret, response, xhr) {
          if ( xhr.status < 200 || xhr.status >= 300 ) {
            sink && sink.error && sink.error(['Could not send']);
            ret();
            return;
          }

          self.lastClientVersion = Math.max(self.lastClientVersion, obj.clientVersion);
          obj = obj.deepClone();
          obj.deleted = true;
          sink && sink.put && sink.put(obj);
          ret();
        })(ret);
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "saveDraft_",
         "code": function (ret, draftId, obj, url, method, sink) {
      var self = this;
      aseq(
        function(ret) {
          // TODO: Updating a draft requires the RAW payload.
          var raw = obj.toRaw();
          var payload = {
            id: draftId,
            message: {
              raw: raw.raw
            }
          };
          var formatter = {
            __proto__: JSONUtil.pretty,
            outputModel_: function(){}
          };


          self.xhr.asend(ret, self.draftUrl + url, formatter.stringify(payload), method);
        },
        function(ret, response, xhr) {
          if ( xhr.status < 200 || xhr.status >= 300 ) {
            sink && sink.error && sink.error(['Error updating/creating draft.', url, method]);
            return;
          }
          self.lastClientVersion = Math.max(self.lastClientVersion, obj.clientVersion);
          self.find('draft_' + response.id, {
            put: function(o) {
              o.messageId = response.message.id;
              o.draftId = response.id
              o.clientVersion = obj.clientVersion;
              ret(o);
            },
            error: function() {
              sink && sink.error && sink.error(['Error fetching created message.']);
            }
          });
        })(ret);
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "put",
         "code": function (obj, sink) {
      var self = this;
      var jsonToObj;
      var dstUrl;
      var dstMethod;

      obj.setHeader(obj.FOAM_MESSAGEID_HEADER, obj.id);

      if ( obj.id.indexOf('draft_') === 0 ) {
        var draftId = obj.draftId || obj.id.substring(6);
      }

      aif(
        obj.id.indexOf('draft_') === 0,
        aseq(
          function(ret) {
            self.xhr.asend(ret, self.draftUrl + '/' + draftId + '?format=minimal');
          },
          function(ret, response, xhr) {
            dstUrl = '/' + draftId;
            dstMethod = "PUT";
            if ( xhr.status === 404 ) {
              dstUrl = '';
              dstMethod = 'POST';
            } else if ( xhr.status !== 200 ) {
              sink && sink.error && sink.error(["Can't fetch draft."]);
              return;
            }
            self.saveDraft_(ret, draftId, obj, dstUrl, dstMethod, sink);
          },
          aif(obj.isSent,
              function(ret, draft) {
                self.sendDraft_(ret, draft.draftId, draft, sink);
              },
              function(ret, draft) {
                self.lastClientVersion = Math.max(self.lastClientVersion, obj.clientVersion);
                sink && sink.put && sink.put(obj);
              }
             )),
        aseq(
          function(ret) {
            self.xhr.asend(ret, self.messageUrl + '/' + obj.id + '?format=minimal');
          },
          function(ret, response, xhr) {
            if ( xhr.status < 200 || xhr.status >= 300 ) {
              sink && sink.error && sink.error(['Error fetching message for comparison.']);
              return;
            }
            var msg = self.jsonToObj(response);
            var diff = msg.labelIds.diff(obj.labelIds);
            if ( diff.added.length == 0 && diff.removed.length == 0 ) {
              ret({}, xhr);
              return;
            }
            var payload = {
              addLabelIds: diff.added,
              removeLabelIds: diff.removed
            };
            self.xhr.asend(ret, self.messageUrl + '/' + obj.id + '/modify', JSON.stringify(payload), "POST");
          },
          function(ret, response, xhr) {
            if ( xhr.status < 200 || xhr.status >= 300 ) {
              sink && sink.error && sink.error(['Error modifying message.']);
              return;
            }
            obj = obj.deepClone();
            if ( response.labelIds ) 
              obj.labelIds = response.labelIds;
            self.lastClientVersion = Math.max(self.lastClientVersion, obj.clientVersion);
            sink && sink.put && sink.put(obj);
          }
        ))(function(){});
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "remove",
         "code": function (obj, sink) {
      sink && sink.error && sink.error('Unimplemented.');
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "find",
         "code": function (key, sink) {
      if ( key.startsWith('draft_') ) {
        this.findDraft_(key, sink);
        return;
      }
      var self = this;
      this.SUPER(key, {
        put: function(o) {
          self.postProcessObject(function(obj) {
            if ( ! obj && sink ) sink.error();
            else if ( sink && sink.put ) sink.put(o);
          }, ( sink && sink.error ) ? sink.error.bind(sink) : function(){}, o);
        },
        error: function(args) {
          if ( args[1] === 404 ) {
            sink && sink.put && sink.put(self.model.create({ id: key, deleted: true }));
            return;
          }
          sink && sink.error && sink.error.apply(sink, arguments);
        }
      });
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "findDraft_",
         "code": function (key, sink) {
      var self = this;
      aseq(
        function(ret) {
          self.xhr.asend(ret, self.draftUrl + '/' + key.substring(6) + '?format=full');
        },
        function(ret, response, xhr) {
          if ( xhr.status < 200 || xhr.status >= 300 || ! response ) {
            sink && sink.error && sink.error(['Error fetching draft', response, xhr]);
            return;
          }
          var msg = self.jsonToObj(response.message);
          msg.id = "draft_" + response.id;
          sink && sink.put && sink.put(msg);
          ret();
        })(function(){});
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "selectFromHistory_",
         "code": function (sink, historyId) {
      sink = sink || [];
      var fc = this.createFlowControl_();
      var self = this;
      var future = afuture();
      this.historyDao.where(GT(this.GMailHistory.ID, historyId))
        .select()(function(items) {
          if ( items && items.length ) {
            var pars = [];
            items.forEach(function(i) {
              i.messages.forEach(function(j) {
                pars.push(function(ret) {
                  self.find(j.id, {
                    put: ret,
                    error: ret
                  });
                });
              });
            });
          }
          aseq(
            apar.apply(null, pars),
            function(ret) {
              var args = argsToArray(arguments);
              args.shift();
              for ( var i = 0; i < args.length && ! fc.stopped; i++ ) {
                if ( fc.errorEvt ) {
                  sink.error && sink.error(fc.errorEvt);
                  future.set(sink);
                  return;
                }
                if ( args[i] ) sink && sink.put(args[i], null, fc);
              }
              sink.eof && sink.eof();
              future.set(sink);
              ret();
            })(function(){});
        });
      return future.get;
    },
         "args": []
      },
      {
         "model_": "Method",
         "name": "select",
         "code": function (sink, options) {
      sink = sink || [].sink;
      if ( MaxExpr.isInstance(sink) && sink.arg1 == this.model.CLIENT_VERSION ) {
        sink.max = this.lastClientVersion;
        return aconstant(sink);
      }

      if ( options && options.query ) {
        var query = options && options.query;

        if ( GtExpr.isInstance(query) && query.arg1 == this.model.HISTORY_ID ) {
          if ( query.arg2.f() !== 0 ) {
            return this.selectFromHistory_(sink, query.arg2.f());
          }
        }
      }
      return this.SUPER(sink, options);
    },
         "args": []
      }
   ],
   "listeners": [],
   "templates": [],
   "models": [],
   "tests": [],
   "relationships": [],
   "issues": []
});