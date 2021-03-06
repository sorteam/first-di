/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { AutowiredOptions } from "../models/autowired-options";
import { ClassConstructor, OverrideConstructor } from "../typings/class-constructor";
import { AutowiredLifetimes } from "../models/autowired-lifetimes";
import { OverrideOptions } from "../models/override-options";

export class DI {

    public static defaultOptions: AutowiredOptions = {
        lifeTime: AutowiredLifetimes.Singleton
    };

    public autowired: (options?: AutowiredOptions) => PropertyDecorator;

    public reset: () => void;

    public resolve: <T extends object>(
        constructor: ClassConstructor<T>,
        options?: AutowiredOptions,
        caller?: object,
        propertyKey?: string | symbol
    ) => T;

    public singleton: <T extends object>(constructor: ClassConstructor<T>, options?: AutowiredOptions) => T;

    public instance: <T extends object>(constructor: ClassConstructor<T>, options?: AutowiredOptions) => T;

    public override: <T extends object>(
        from: OverrideConstructor<object>, // must be T, but typescript have bug with private property from implement class
        to: ClassConstructor<T>,
        options?: AutowiredOptions
    ) => void;

    protected singletonsList: Map<ClassConstructor<object>, object> = new Map<ClassConstructor<object>, object>();

    protected overrideList: Map<OverrideConstructor<object>, OverrideOptions> = new Map<ClassConstructor<object>, OverrideOptions>();

    constructor() {
        this.autowired = (options?: AutowiredOptions) => this.makeAutowired(options);
        this.reset = () => this.makeReset();

        this.resolve = <T extends object>(
            constructor: ClassConstructor<T>,
            options?: AutowiredOptions,
            caller?: object,
            propertyKey?: string | symbol
        ) => this.makeResolve(constructor, options, caller, propertyKey);

        this.singleton = <T extends object>(
            constructor: ClassConstructor<T>,
            options?: AutowiredOptions
        ) => this.makeResolve(constructor, { ...options, lifeTime: AutowiredLifetimes.Singleton });

        this.instance = <T extends object>(
            constructor: ClassConstructor<T>,
            options?: AutowiredOptions
        ) => this.makeResolve(constructor, { ...options, lifeTime: AutowiredLifetimes.PerInstance });

        this.override = <T extends object>(
            from: OverrideConstructor<T>,
            to: ClassConstructor<T>,
            options?: AutowiredOptions
        ) => this.makeOverride(from, to, options);
    }

    protected makeAutowired(options?: AutowiredOptions): PropertyDecorator {
        return (target: object, propertyKey: string | symbol): void => {
            const type = (Reflect as any).getMetadata("design:type", target, propertyKey) as ClassConstructor<object>;
            const { resolve } = this;

            Reflect.defineProperty(
                target,
                propertyKey,
                {
                    configurable: false,
                    enumerable: false,
                    get() {
                        return resolve(type, options, this, propertyKey);
                    }
                }
            );
        };
    }

    protected makeResolve<T extends object>(
        inConstructor: ClassConstructor<T>,
        inOptions?: AutowiredOptions,
        caller?: object,
        propertyKey?: string | symbol
    ): T {
        let constructor = inConstructor;
        let options = inOptions;

        if (this.overrideList.has(constructor)) {
            const overridOptions = this.overrideList.get(constructor) as OverrideOptions;
            constructor = overridOptions.to as ClassConstructor<T>;
            options = overridOptions.options ?? options;
        }

        const lifeTime = options?.lifeTime ?? AutowiredLifetimes.Singleton;
        if (lifeTime === AutowiredLifetimes.Singleton) {
            if (this.singletonsList.has(constructor)) {
                return this.singletonsList.get(constructor) as T;
            }
        } else if (lifeTime === AutowiredLifetimes.PerOwned && propertyKey) {
            if (Reflect.has(constructor, this.getDiKey(propertyKey))) {
                return Reflect.get(constructor, this.getDiKey(propertyKey)) as T;
            }
        } else if (lifeTime === AutowiredLifetimes.PerInstance && caller && propertyKey) {
            if (Reflect.has(caller, this.getDiKey(propertyKey))) {
                return Reflect.get(caller, this.getDiKey(propertyKey)) as T;
            }
        }

        const params: ClassConstructor<object>[] = (Reflect as any).getMetadata("design:paramtypes", constructor) as [] || [];

        const object = new constructor(...params
            .map((paramConstructor: ClassConstructor<object>) => this.makeResolve(paramConstructor, options)));

        if (lifeTime === AutowiredLifetimes.Singleton) {
            this.singletonsList.set(constructor, object);
        } else if (lifeTime === AutowiredLifetimes.PerOwned) {
            Reflect.set(constructor, this.getDiKey(propertyKey), object);
        } else if (lifeTime === AutowiredLifetimes.PerInstance && caller) {
            Reflect.set(caller, this.getDiKey(propertyKey), object);
        }

        return object;
    }

    protected makeReset(): void {
        this.singletonsList = new Map<ClassConstructor<object>, object>();
        this.overrideList = new Map<ClassConstructor<object>, OverrideOptions>();
    }

    protected makeOverride<T extends object>(from: OverrideConstructor<T>, to: ClassConstructor<T>, options?: AutowiredOptions): void {
        this.overrideList.set(from, { to, options });
    }

    protected getDiKey(propertyKey?: string | symbol): string {
        return `$_di_${String(propertyKey)}`; // think about symbol
    }

}
