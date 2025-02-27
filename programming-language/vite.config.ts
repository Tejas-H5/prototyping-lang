import path from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "/Working-on-Tree/",
  plugins: [viteSingleFile()],
  build: {
    // Would like people to see the source code of the thing they're using actually - it should 
    // make bug reporting and open source contributions a bit easier.
    // Also this is somewhat the only demo of this framework in existance at the moment. 
    minify: false,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, "src/")
    }
  }
});
