"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  NinjaAuth: () => NinjaAuth
});
module.exports = __toCommonJS(index_exports);

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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NinjaAuth
});
//# sourceMappingURL=index.cjs.map