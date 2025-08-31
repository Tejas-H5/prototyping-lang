# Try it [here](https://tejas-h5.github.io/prototyping-lang/)

I am attempting to make a small programming language that can be used to quickly try out and visualize various mathematical and algorithmic ideas.
My assumption is that when the parser, interpreter, debugger, and editor all live in the same codebase, a lot of opportunities for improving
user experience will arise naturally, and be easier to fulfil than they usually are.

It's also a good opportunity to see if the web SPA immediate mode UI framework I'm working on can scale to larger projects. 
I've already had some success with it on a smaller scale project.

## File structure

We haven't introduced AI to this codebase yet, but when we do, surely this will be helpful:

```
programming-language/
    various_configs_files.blah

    src/
        main.ts             entrypoint
        global-context.ts   TODO: merge state.ts and global-context.ts
        app-styling.ts      Self explanatory
        version-number.ts   Bump this whenever we release a new version or update the schema in a non-compatible way

        app-views/          main.ts and state.ts may be broken up into 'views' that we put into here, either for code reuse or to simplify or organise the code better. Views are tightly coupled to the app. If they aren't, we can just make them an app component or a normal component.

        app-components/     components reused accross this app
        app-utils/          utils reused accross this app
        components/         components copy-pasted accross multiple projects
        utils/              utils copy-pasted accross multiple projects
        legacy-components/  TODO (Me): port these, put them into `components/`. The checkbox in particular was pretty cool if I remember correctly.
```

## Why web, and not a 'real' language?

- Faster prototying, and a lot of builtin primitives like text inputs and text rendering in general
- The deployment is easier to access and distribute. People are ok with clicking links to random sites, but not downloading and running random exe files.

Web still has a lot of low-hanging fruit that no one is grabbing, because the entire ecosystem has
decided to moved towards observability/signals, or functional programming.
I like the simplicity of React's memoization approach, and I reckon it can be very good if it's executed properly, i.e
inside of `requestAnimationFrame` with as close to zero GC pressure as possible.
This is not the current state of React.
Observability also sounds good in theory, but in practice, it just leads to a lot of large implicit computation graphs
where querying + mutating a datastructure in a way that isn't cognizent of observability can cripple performance.
Sounds like skill issue, but it can happen pretty easily as you're refactoring code. 
A better approach to observability is probably to explicitly mark some state as being a `Cell<T>`, rather than implicity
proxying everything inside an object. Anyway, in practice it is anything but simple.

