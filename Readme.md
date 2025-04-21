# Try it [here](https://tejas-h5.github.io/prototyping-lang/)

I am attempting to make a small programming language that can be used to quickly try out and visualize various mathematical and algorithmic ideas.
My assumption is that when the parser, interpreter, debugger, and editor all live in the same codebase, a lot of opportunities for improving
user experience will arise naturally, and be easier to fulfil than they usually are.

It's also an opportunity to dog-food a custom web-based immediate mode UI framework that I've had an idea of making for a while now. The
version of the framework that I'm using here will actually be _more_ up-to-date than the one in it's own repo: (https://github.com/Tejas-H5/dom-utils-im).

Eventually, I would also like to explore the idea of replacing the text-editor with a custom AST-based editor that allows editing the AST directly,
rather than making edits to the text itself. I've heard this idea being floated around while listening to Ryan Fleury on a youtube programming 
podcast, and it clicked with me the moment I heard it. It's a bit surprising that it hasn't caught on, really.
The closest thing we have so far that is ubiquitous is the browser dev tools `inspect` tab tree, which is not at all designed for writing code.
Mine would need to work something like this:

```
// This renders at the monitor refresh rate, like in a typical immediate mode UI program.
// However, the immediate mode tree is stateful, and works a lot like REACT hooks. 
// Every immediate mode component must render the same number of things every time.
// One of the things it can render is a 'list' component that can render an arbitrary number of subcomponents, which is how we get around this.
imCodeEditor() {
    imBeginList();
    if (nextListRoot() && hasValidAst()) {
        imAstEditor();
    } else {
        // fallback to normal text editor.
        // If the text we loaded was an AST, and every edit to the AST is valid, i.e the program
        // was written correctly, and the code is only ever opened within the AST editor, then this 
        // UI branch should basically never run. 
        nextListRoot();
        imTextEditor();
    }
    imEndList();

    if (imBeginMemo().val(state.code).changed()) {
        debouncedSaveAst();
        recomputeAst(state);
    } imEndMemo();
}
```


## Why web, and not a 'real' language?

- Faster prototying, and a lot of builtin primitives like text inputs and text rendering in general
- The deployment is easier to access and distribute. People are ok with clicking links to random sites, but not downloading and running random exe files.

Web still has a lot of low-hanging fruit that no one is grabbing, because the entire ecosystem has
decided to moved towards observability/signals, or functional programming.
I like the simplicity of React's memoization approach, and I reckon it can be very good if it's executed properly, i.e
inside of `requestAnimationFrame` with as close to zero GC pressure as possible.
This is not the current state of React.
Observability is also good in theory, but in practice, it just leads to a lot of large implicit computation graphs
where querying + mutating a datastructure in a loop can cripple performance in ways that are very hard to fix
without rearchitecting everything, or collecting all the computations into an array, and then looping over them later in a second pass, 
neither of which are a good solution. It is mostly a dead end. 

I might use a compiler to infer `imBeginList()` and `nextListRoot()` if I figure out an easy way to do this.
An initial thought was to use the line number that the component was defined to assign each component a unique ID.
This can be done by implementing my immediate mode UI lowest level core primitive like this:
```
let lineNum = 0;
let colNum = 0;
function imUIRoot(args, line = lineNum, col = colNum) {
}
```
Then a babel transformer can just insert `lineNum = blah; colNum = blah;` above every single invocation of a method that starts wtih
`im` in my compilation step.
The Odin language actually has a #position or whatever macro that would be very useful for this.
Lots of ideas here.
However, if multiple instances of the same component are being rendered, this won't work without every user component needing to 
also define line = lineNum, col = colNum in it's signature, which is not ideal. 


## How to run

1. Install NodeJS
2. run `npm install` in the `programming-language` directory
3. run `npm run dev` to start the vite dev server
4. run `npm build` to create an offline build


