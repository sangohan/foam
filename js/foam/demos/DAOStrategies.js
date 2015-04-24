/**
 * @license
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

CLASS({
  package: 'foam.demos',
  name: 'DAOStrategies',
  extendsModel: 'foam.graphics.CView',

  requires: [
    'foam.graphics.CView',
    'foam.graphics.ImageCView',
    'foam.graphics.Label2',
    'foam.graphics.LabelledBox',
    'foam.input.Mouse'
  ],

  constants: {
    COLOURS: {
      'Google Cloud': 320,
      'Local Storage': 320,
      'Array': 320,
      'MongoDB': 320,
      'Chrome Storage': 320,
      'Sync Storage': 320,
      'JSONFile': 320,
      'IndexedDB': 320,
      'REST Server': 14,
      'REST Client': 14,
      Migration: 225,
      Logging: 225,
      Timing: 225,
      SeqNo: 225,
      GUID: 225,
      Validating: 225,
      Caching: 120,
      Sync: 120,
//      'Business Logic': 225
    },

    STRATEGIES: [
      [ 'Local Storage' ],
      [ 'IndexedDB' ],
      [ 'IndexedDB', 'Caching' ],
      [ 'Array' ],
      [ 'Chrome Storage' ],
      [ 'Chrome Storage' ],
      [ 'Server', '', 'Adapter' ],
      [ 'MongoDB', 'REST Server', '', 'REST Client' ],
      [ 'JSONFile', 'REST Server', '', 'REST Client' ],
      [ 'Google', '', 'Google Cloud' ],
      [ 'Server', '', 'Client', 'Caching' ],
      [ 'Server', '', 'Client', 'Sync' ],
      [ '???', 'SeqNo' ],
      [ '???', 'GUID' ],
      [ '???', 'Logging' ],
      [ '???', 'Timing' ],
      [ '???', 'Validating' ],
      [ '???', 'Migration' ],
      [ '???', 'Your Decorator' ],
      [ '???', 'Business Logic' ],
      [ '???' ]
    ]
  },

  properties: [
    { name: 'width',  defaultValue: 1800 },
    { name: 'height', defaultValue: 900 },
    {
      name: 'mouse',
      transient: true,
      hidden: true,
      lazyFactory: function() { return this.Mouse.create(); }
    }
  ],

  methods: {
    initCView: function() {
      this.SUPER();

      var M = Movement;
      var S = this.STRATEGIES;
      var H = 40;
      var self = this;

      this.addChild(this.ImageCView.create({
        x: 1530,
        y: 380,
        src: './js/foam/demos/empire/todo.png'
      }));

      for ( var i = 0 ; i < S.length ; i++ ) {
        var v = this.makeStrategyView(S[i]);
        v.x = 1400;
        v.y = 30 + H * i;
        this.addChild(v);
      }
      this.mouse.connect(this.view.$);
      this.mouse.y$.addListener(function(_, y) {
        self.view.paint();
      });
    },

    makeStrategyView: function(s) {
      var v = this.CView.create({width: 500, height: 32, x:0, y:0});

      for ( var i = 0 ; i < s.length ; i++ ) {
        var t = s[i];
        var c = this.COLOURS[t];
        v.addChild(this.LabelledBox.create({
          font: '18px Arial',
          background: c ? 'hsl(' + c + ',70%,90%)' : 'white',
          x: -140 * (s.length - i),
          y: ! t ? 16 : 0,
          width:  140,
          height: ! t ? 1 : 32,
          text:   t
        }));
      }

      this.mouse.y$.addListener(function() {
        var d = Math.abs(this.mouse.y - (v.y+v.height/2));
        v.scaleX = 2.5 - 1.5 * Math.min(1, d / 100);
      }.bind(this));

      return v;
    }
  }
});