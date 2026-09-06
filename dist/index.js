// src/NinjaAuth.ts
var VERSION = "0.1.0";
var NinjaAuthClient = class {
  constructor() {
    this.config = null;
    this.version = VERSION;
  }
  init(config) {
    if (!config.clientID) {
      throw new Error("NinjaAuth: clientID is required.");
    }
    if (!config.returnURL) {
      throw new Error("NinjaAuth: returnURL is required.");
    }
    this.config = {
      clientID: config.clientID,
      returnURL: config.returnURL
    };
  }
  async logIn() {
    if (!this.config) {
      throw new Error(
        "NinjaAuth: call init() before logIn()."
      );
    }
    throw new Error("NinjaAuth.logIn() is not implemented yet.");
  }
  async logOut() {
  }
  async getUser() {
    return null;
  }
};
var NinjaAuth = new NinjaAuthClient();
export {
  NinjaAuth
};
//# sourceMappingURL=index.js.map