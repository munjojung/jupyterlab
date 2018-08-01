// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { expect } from 'chai';

import { toArray } from '@phosphor/algorithm';

import { JSONExt } from '@phosphor/coreutils';

import { KernelManager, Kernel } from '../../../lib/kernel';

import {
  PYTHON_SPEC,
  KERNELSPECS,
  handleRequest,
  makeSettings,
  testEmission
} from '../utils';

const PYTHON3_SPEC = JSON.parse(JSON.stringify(PYTHON_SPEC));
PYTHON3_SPEC.name = 'Python3';
PYTHON3_SPEC.display_name = 'python3';

describe('kernel/manager', () => {
  const manager: KernelManager;
  const specs: Kernel.ISpecModels;
  const kernel: Kernel.IKernel;

  before(() => {
    return Kernel.getSpecs()
      .then(s => {
        specs = s;
        return Kernel.startNew();
      })
      .then(k => {
        kernel = k;
      });
  });

  beforeEach(() => {
    manager = new KernelManager();
    expect(manager.specs).to.be.null;
    return manager.ready;
  });

  afterEach(() => {
    manager.dispose();
  });

  after(() => {
    return Kernel.shutdownAll();
  });

  describe('KernelManager', () => {
    describe('#constructor()', () => {
      it('should take the options as an argument', () => {
        manager.dispose();
        manager = new KernelManager({ serverSettings: makeSettings() });
        expect(manager instanceof KernelManager).to.equal(true);
      });
    });

    describe('#serverSettings', () => {
      it('should get the server settings', () => {
        manager.dispose();
        const serverSettings = makeSettings();
        const token = serverSettings.token;
        manager = new KernelManager({ serverSettings });
        expect(manager.serverSettings.token).to.equal(token);
      });
    });

    describe('#specs', () => {
      it('should get the kernel specs', () => {
        return manager.ready.then(() => {
          expect(manager.specs.default).to.be.ok;
        });
      });
    });

    describe('#running()', () => {
      it('should get the running sessions', () => {
        return manager.refreshRunning().then(() => {
          expect(toArray(manager.running()).length).to.be.greaterThan(0);
        });
      });
    });

    describe('#specsChanged', () => {
      it('should be emitted when the specs change', async () => {
        const specs = JSONExt.deepCopy(KERNELSPECS) as Kernel.ISpecModels;
        specs.default = 'shell';
        handleRequest(manager, 200, specs);
        manager.specsChanged.connect((sender, args) => {
          expect(sender).to.equal(manager);
          expect(args.default).to.equal(specs.default);
          done();
        });
        manager.refreshSpecs();
      });
    });

    describe('#runningChanged', () => {
      it('should be emitted in refreshRunning when the running kernels changed', async () => {
        manager.runningChanged.connect((sender, args) => {
          expect(sender).to.equal(manager);
          expect(toArray(args).length).to.be.greaterThan(0);
          done();
        });
        Kernel.startNew()
          .then(() => {
            return manager.refreshRunning();
          })
          .catch(done);
      });

      it('should be emitted when a kernel is shut down', async () => {
        manager
          .startNew()
          .then(kernel => {
            manager.runningChanged.connect(() => {
              manager.dispose();
              done();
            });
            return kernel.shutdown();
          })
          .catch(done);
      });
    });

    describe('#isReady', () => {
      it('should test whether the manager is ready', () => {
        manager.dispose();
        manager = new KernelManager();
        expect(manager.isReady).to.equal(false);
        return manager.ready.then(() => {
          expect(manager.isReady).to.equal(true);
        });
      });
    });

    describe('#ready', () => {
      it('should resolve when the manager is ready', () => {
        return manager.ready;
      });
    });

    describe('#refreshSpecs()', () => {
      it('should update list of kernel specs', () => {
        const specs = JSONExt.deepCopy(KERNELSPECS) as Kernel.ISpecModels;
        specs.default = 'shell';
        handleRequest(manager, 200, specs);
        return manager.refreshSpecs().then(() => {
          expect(manager.specs.default).to.equal(specs.default);
        });
      });
    });

    describe('#refreshRunning()', () => {
      it('should update the running kernels', () => {
        return manager.refreshRunning().then(() => {
          expect(toArray(manager.running()).length).to.be.greaterThan(0);
        });
      });
    });

    describe('#startNew()', () => {
      it('should start a new kernel', () => {
        return manager.startNew();
      });

      it('should emit a runningChanged signal', async () => {
        manager.runningChanged.connect(() => {
          done();
        });
        manager.startNew().catch(done);
      });
    });

    describe('#findById()', () => {
      it('should find an existing kernel by id', () => {
        const id = kernel.id;
        return manager.findById(id).then(model => {
          expect(model.id).to.equal(id);
        });
      });
    });

    describe('#connectTo()', () => {
      it('should connect to an existing kernel', () => {
        const id = kernel.id;
        const newConnection = manager.connectTo(kernel.model);
        expect(newConnection.model.id).to.equal(id);
      });

      it('should emit a runningChanged signal', async () => {
        manager.runningChanged.connect(() => {
          done();
        });
        Kernel.startNew()
          .then(k => {
            manager.connectTo(k.model);
          })
          .catch(done);
      });
    });

    describe('shutdown()', () => {
      it('should shut down a kernel by id', async () => {
        const kernel = await manager.startNew();
        await kernel.ready;
        await manager.shutdown(kernel.id);
        expect(kernel.isDisposed).to.equal(true);
      });

      it('should emit a runningChanged signal', async () => {
        const kernel = await manager.startNew();
        const emission = testEmission(manager.runningChanged, {
          test: () => {
            expect(kernel.isDisposed).to.equal(false);
          }
        });
        await manager.shutdown(kernel.id);
        await emission;
      });
    });
  });
});
