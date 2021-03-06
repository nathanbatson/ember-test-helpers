import Ember from 'ember';
import { TestModule, getContext } from 'ember-test-helpers';
import hasEmberVersion from 'ember-test-helpers/has-ember-version';
import test from 'tests/test-support/qunit-test';
import qunitModuleFor from 'tests/test-support/qunit-module-for';
import { setResolverRegistry, createCustomResolver } from 'tests/test-support/resolver';

// The fixture reset tests are order dependent
QUnit.config.reorder = false;

function moduleFor(fullName, description, callbacks) {
  var module = new TestModule(fullName, description, callbacks);
  qunitModuleFor(module);
}

function setupRegistry() {
  setResolverRegistry({
    'component:x-foo':           Ember.Component.extend(),
    'component:not-the-subject': Ember.Component.extend(),
    'foo:thing': Ember.Object.extend({
      fromDefaultRegistry: true
    }),
    'service:other-thing': Ember.Object.extend({
      fromDefaultRegistry: true
    })

  });
}

var callbackOrder, setupContext, teardownContext, beforeSetupContext, afterTeardownContext, originalDeprecate;

moduleFor('component:x-foo', 'TestModule callbacks', {
  beforeSetup() {
    beforeSetupContext = this;
    callbackOrder = [ 'beforeSetup' ];

    setupRegistry();
  },

  setup() {
    setupContext = this;
    callbackOrder.push('setup');

    ok(setupContext !== beforeSetupContext);
  },

  teardown() {
    teardownContext = this;
    callbackOrder.push('teardown');

    deepEqual(callbackOrder, [ 'beforeSetup', 'setup', 'teardown']);
    equal(setupContext, teardownContext);
  },

  afterTeardown() {
    afterTeardownContext = this;
    callbackOrder.push('afterTeardown');
    equal(this.context, undefined, "don't leak the this.context");
    equal(getContext(), undefined, "don't leak the internal context");
    deepEqual(callbackOrder, [ 'beforeSetup', 'setup', 'teardown', 'afterTeardown']);
    equal(afterTeardownContext, beforeSetupContext);
    ok(afterTeardownContext !== teardownContext);
  }
});

test("setup callbacks called in the correct order", function() {
  deepEqual(callbackOrder, [ 'beforeSetup', 'setup' ]);
});

moduleFor('component:x-foo', 'component:x-foo -- setup context', {
  beforeSetup() {
    setupRegistry();
  },

  setup() {
    this.subject({
      name: 'Max'
    });

    this.register('service:blah', Ember.Object.extend({
      purpose: 'blabering'
    }));
  }
});

test("subject can be initialized in setup", function() {
  equal(this.subject().name, 'Max');
});

test("can lookup factory registered in setup", function() {
  this.inject.service('blah');
  equal(Ember.get(this, 'blah.purpose'), 'blabering');
});

test("overrides `toString` to return the test subject", function(){
  equal(this.toString(), 'test context for: component:x-foo', 'toString returns `test context for: subjectName`');
});

moduleFor('component:x-foo', 'component:x-foo -- callback context', {
  beforeSetup() {
    setupRegistry();
  },

  setup() {
    originalDeprecate = Ember.deprecate;
  },

  teardown() {
    Ember.deprecate = originalDeprecate;
  },

  getSubjectName() {
    return this.subjectName;
  },

  getFoo() {
    return this.foo;
  }
});

test("can access TestModule properties from a callback but raises a deprecation", function() {
  var deprecations = [];
  Ember.deprecate = function(message) {
    deprecations.push(message);
  };

  equal(this.getSubjectName(), 'component:x-foo');
  ok(Ember.A(deprecations).contains('Accessing the test module property "subjectName" from a callback is deprecated.'));
});

test("can access test context properties from a callback's 'this' and not raise a deprecation", function() {
  var deprecations = [];
  Ember.deprecate = function(message, test) {
    if (!test) {
      deprecations.push(message);
    }
  };

  this.foo = 'bar';

  equal(this.getFoo(), 'bar');
  ok(!deprecations.length);
});

moduleFor('component:x-foo', 'component:x-foo -- created subjects are cleaned up', {
  beforeSetup() {
    setupRegistry();
  },

  afterTeardown() {
    var subject = this.cache.subject;

    ok(subject.isDestroyed);
  }
});

test("subject's created in a test are destroyed", function() {
  this.subject();
});

moduleFor('component:x-foo', 'component:x-foo -- uncreated subjects do not error', {
  beforeSetup() {
    setupRegistry();
  }
});

test("subject's created in a test are destroyed", function() {
  expect(0);
});

moduleFor('component:x-foo', 'component:x-foo -- without needs or `integration: true`', {
  beforeSetup: setupRegistry()
});

test("knows nothing about our non-subject component", function() {
  var otherComponent = this.container.lookup('component:not-the-subject');
  equal(null, otherComponent, "We shouldn't know about a non-subject component");
});

moduleFor('component:x-foo', 'component:x-foo -- when needing another component', {
  beforeSetup: setupRegistry(),
  needs: ['component:not-the-subject']
});

test("needs gets us the component we need", function() {
  var otherComponent = this.container.lookup('component:not-the-subject');
  ok(otherComponent, "another component can be resolved when it's in our needs array");
});

moduleFor('component:x-foo', 'component:x-foo -- `integration`', {
  beforeSetup() {
    setupRegistry();
    ok(!this.callbacks.integration, "integration property should be removed from callbacks");
    ok(this.isIntegration, "isIntegration should be set when we set `integration: true` in callbacks");
  },
  integration: true
});

test("needs is not needed (pun intended) when integration is true", function() {
  var otherComponent = this.container.lookup('component:not-the-subject');
  ok(otherComponent, 'another component can be resolved when integration is true');
});

test("throws an error when declaring integration: true and needs in the same module", function() {
  expect(3);

  var result = false;

  try {
    moduleFor('component:x-foo', {
      integration: true,
      needs: ['component:x-bar']
    });
  } catch(err) {
    result = true;
  }

  ok(result, "should throw an Error when integration: true and needs are provided");
});

test("throws an error when declaring integration: 'legacy' in `moduleFor` test", function() {
  expect(3);

  var result = false;

  try {
    moduleFor('component:x-foo', {
      integration: 'legacy'
    });
  } catch(err) {
    result = true;
  }

  ok(result, "should throw an Error when integration: 'legacy' outside of a component integration test");
});

if (hasEmberVersion(1,11)) {
  moduleFor('component:x-foo', 'should be able to override factories in integration mode', {
    beforeSetup() {
      setupRegistry();
    },

    integration: true
  });

  test('gets the default by default', function() {
    var thing = this.container.lookup('foo:thing');

    ok(thing.fromDefaultRegistry, 'found from the default registry');
  });

  test('can override the default', function() {
    this.register('foo:thing', Ember.Object.extend({
      notTheDefault: true
    }));
    var thing = this.container.lookup('foo:thing');

    ok(!thing.fromDefaultRegistry, 'should not be found from the default registry');
    ok(thing.notTheDefault, 'found from the overridden factory');
  });

  test('gets the default with fullName normalization by default', function() {
    this.register('foo:needs-service', Ember.Object.extend({
      otherThing: Ember.inject.service()
    }));

    var foo = this.container.lookup('foo:needs-service');
    var thing = foo.get('otherThing');

    ok(thing.fromDefaultRegistry, 'found from the default registry');
  });

  test('can override the default with fullName normalization', function() {
    this.register('service:other-thing', Ember.Object.extend({
      notTheDefault: true
    }));

    this.register('foo:needs-service', Ember.Object.extend({
      otherThing: Ember.inject.service()
    }));

    var foo = this.container.lookup('foo:needs-service');
    var thing = foo.get('otherThing');

    ok(!thing.fromDefaultRegistry, 'should not be found from the default registry');
    ok(thing.notTheDefault, 'found from the overridden factory');
  });
}

if (hasEmberVersion(2, 3)) {
  moduleFor('foo:thing', 'should be able to use `getOwner` on instances', {
    beforeSetup() {
      setupRegistry();
    },

    integration: true
  });

  test('instances get an owner', function() {
    var subject = this.subject();
    var owner = Ember.getOwner(subject);

    var otherThing = owner.lookup('service:other-thing');
    ok(otherThing.fromDefaultRegistry, 'was able to use `getOwner` on an instance and lookup an instance');
  });

  test('test context gets an owner', function() {
    var owner = Ember.getOwner(this);

    var otherThing = owner.lookup('service:other-thing');
    ok(otherThing.fromDefaultRegistry, 'was able to use `getOwner` on test context and lookup an instance');
  });
}

var contexts, module;
QUnit.module('context can be provided to TestModule', {
  beforeEach() {
    contexts = [this];
    module = new TestModule('component:x-foo', 'Foo', {
      setup() {
        contexts.push(this);
      },
      teardown() {
        contexts.push(this);
      }
    });

    module.setContext(this);
    return module.setup(...arguments);
  },

  afterEach(assert) {
    return module.teardown(...arguments)
      .then(() => {
        contexts.forEach((context) => {
          assert.ok(context === this, 'contexts should equal');
        });
      });
  }
});

test('noop', function() {
  contexts.push(this);
});

moduleFor('component:y-foo', 'Custom resolver', {
  resolver: createCustomResolver({
    'component:y-foo': Ember.Component.extend({
      name: 'Y u no foo?!'
    })
  })
});

test('subject created using custom resolver', function() {
  equal(this.subject().name, 'Y u no foo?!');
});

test("`toString` returns the test subject", function(){
  equal(this.toString(), 'test context for: component:y-foo', 'toString returns `test context for: subjectName`');
});

moduleFor('component:x-foo', 'ember-testing resets to empty value');

test('sets ember-testing content to "foobar"', function() {
  expect(0);
  document.getElementById('ember-testing').innerHTML = 'foobar';
});

test('ember-testing content should be reset to ""', function() {
  expect(1);
  equal(document.getElementById('ember-testing').innerHTML, '');
});

QUnit.module('ember-testing resets to non-empty value');

test('sets ember-testing content to "<div>foobar</div>"', function() {
  expect(0);
  document.getElementById('ember-testing').innerHTML = '<div>foobar</div>';
});

test('sets ember-testing content to ""', function() {
  expect(0);

  module = new TestModule('component:x-foo', 'Foo');
  module.setContext(this);
  return module.setup(...arguments).then(() => {
    document.getElementById('ember-testing').innerHTML = '';

    return module.teardown(...arguments);
  });
});

test('ember-testing content should be reset to "<div>foobar</div>"', function() {
  expect(1);
  equal(document.getElementById('ember-testing').innerHTML, '<div>foobar</div>');
  document.getElementById('ember-testing').innerHTML = '';
});
