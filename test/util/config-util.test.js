const expect = require('chai').expect;

const Util = require("../../dist/lib/util/config.util");
const EnvironmentVariableProvider = Util.EnvironmentVariableProvider;
const FileProvider = Util.FileProvider;
const ObjectProvider = Util.ObjectProvider;
const loadConfig = Util.loadConfig;
const path = require('path');

it('should load all providers', () => {
    const providers = loadConfig(new EnvironmentVariableProvider()).orElse(new FileProvider("")).providers;
    expect(providers.length).to.equal(2);
});

it('should load a property from the correct provider', async () => {
    const loadedFromObject = await loadConfig(new EnvironmentVariableProvider())
        .orElse(new ObjectProvider({numbers: {of: {processors: "0"}}}))
        .orElse(new FileProvider(path.resolve(__dirname, "util-test.json")))
        .load("numbers.of.processors");

    const loadedFromEnv = await loadConfig(new EnvironmentVariableProvider())
        .orElse(new ObjectProvider({numbers: {of: {processors: "0"}}}))
        .orElse(new FileProvider(path.resolve(__dirname, "util-test.json")))
        .load("number.of.processors");

    const loadedFromJson = await loadConfig(new EnvironmentVariableProvider())
        .orElse(new ObjectProvider({numbers: {of: {processors: "0"}}}))
        .orElse(new FileProvider(path.resolve(__dirname, "util-test.json")))
        .load("number.of.json");
    expect(parseInt(loadedFromObject)).to.equal(0);
    expect(parseInt(loadedFromEnv)).to.be.above(0);
    expect(loadedFromJson).to.equal(-1);
});