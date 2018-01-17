import {isNullOrUndefined, isObject} from "util";
import * as fs from 'fs';
import * as yaml from 'js-yaml';


export function loadConfig(firstProvider: ConfigurationProvider): ConfigurationLoader {
    return new ConfigurationLoader().orElse(firstProvider);
}

export class ConfigurationLoader {
    private providers: ConfigurationProvider[] = [];

    orElse(nextProvider: ConfigurationProvider): ConfigurationLoader {
        this.providers.push(nextProvider);
        return this;
    }

    load(property: string): Promise<any> {
        return new Promise(resolve => {
            for (let i in this.providers) {
                const provider = this.providers[i];
                const retrieved = provider.getProperty(property);
                if (!isNullOrUndefined(retrieved) && "" != retrieved) {
                    resolve(retrieved);
                }
            }
            resolve("");
        });

    }

    loadSync(property: string): any {
        for (let i in this.providers) {
            const provider = this.providers[i];
            const retrieved = provider.getProperty(property);
            if (!isNullOrUndefined(retrieved) && "" != retrieved) {
                return retrieved;
            }
        }
        return "";
    }
}

export interface ConfigurationProvider {

    getProperty(property: string): any

}

export class EnvironmentVariableProvider implements ConfigurationProvider {
    constructor() {
        if (typeof process === 'undefined') {
            throw new Error("FileProvider is only usable on a NodeJS runtime");
        }
    }

    getProperty(property: string): any {
        const envVar = property.split(".").map(s => s.toUpperCase().trim()).join("_");
        return process.env[envVar];
    }

}

export class FileProvider implements ConfigurationProvider {
    private filePath: string;
    private charset: string;

    constructor(filepath: string, charset: string = 'utf8') {
        if (typeof process === 'undefined') {
            throw new Error("FileProvider is only usable on a NodeJS runtime");
        }
        this.filePath = filepath;
        this.charset = charset;
    }

    getProperty(property: string): any {
        if (this.filePath.endsWith(".json")) {
            const jsonObject = this.loadJson();
            return getPropertyFromObject(jsonObject, property);
        } else if (this.filePath.endsWith(".yaml") || this.filePath.endsWith(".yml")) {
            const yamlObject = this.loadYaml();
            return getPropertyFromObject(yamlObject, property);
        } else {
            return undefined;
        }
    }

    private loadJson(): Object {
        return JSON.parse(fs.readFileSync(this.filePath, this.charset));
    }

    private loadYaml(): Object {
        return yaml.safeLoad(fs.readFileSync(this.filePath, this.charset));
    }
}

export class ObjectProvider implements ConfigurationProvider {
    private obj: Object;

    constructor(obj: Object) {
        this.obj = obj;
    }

    getProperty(property: string): any {
        return getPropertyFromObject(this.obj, property);
    }


}

function getPropertyFromObject(object: Object, property: string) {
    const slices = property.split(".");

    let current: any = object;
    for (let p of slices) {
        current = current[p];
        if (slices.indexOf(p) + 1 === slices.length) {
            return current;
        }
    }
    return undefined;
}

export function loadYaml(filename: string, charset: string = 'utf8'): any {
    return yaml.safeLoad(fs.readFileSync(filename, charset));
}