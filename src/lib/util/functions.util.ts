import * as fs from "fs";
import * as yaml from 'js-yaml';

export function sanitize(str: string): string {
    return str.replace('<', '\\<').replace('>', '\\/')
}

export function getPropertyFromObject(object: Object, property: string) {
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