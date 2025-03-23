# Try here (TODO: insert link)

I am attempting to make a small programming language that can be used to quickly try out and visualize various mathematical and algorithmic ideas.

It's also an opportunity to dog-food a custom web-based immediate mode UI framework that I've had an idea of making for a while now. The
version of the framework that I'm using here will actually be _more_ up-to-date than the one in it's own repo: (https://github.com/Tejas-H5/dom-utils-im).

Eventually, I would also like to explore the idea of replacing the text-editor with a custom AST-based editor that allows editing the AST directly,
rather than making edits to the text itself. I've heard this idea being floated around while listening to Ryan Fleury on a youtube programming 
podcast, and it clicked with me the moment I heard it, and I reckon I have a good idea for the execution. The workflow would look like this:

```
on startup -> Read the code into the AST
while editing -> Ui keeps track of 'current' node, allows for moving around, editing, copying and pasting nodes directly via the keyboard
on save -> Convert AST back to text to save, possibly async
```

## Why web, and not a 'real' language?

- Faster prototying, and a lot of builtin primitives like text inputs and text rendering in general
- The deployment is easier to access and distribute. People are ok with clicking links to random sites, but not downloading and running random exe files.
