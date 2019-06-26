import path from 'path'
import * as fs from 'async-file'
import './wasm_exec'

// Not sure why eslint ignores this definition from wasm_exec.d.ts,
// but this doesn't work without the following disable
// eslint-disable-next-line no-undef
const go = new Go()

class HCLParser {
  private wasmModule: Promise<WebAssembly.Module> | null = null

  get wasmInstance(): Promise<WebAssembly.Instance> {
    if (this.wasmModule === null) {
      // Load web assembly module data once in the life of a parser
      this.wasmModule = (async () => {
        // Relative path from source location
        const modulePath = path.join(__dirname, '..', '..', 'hcl.wasm')
        const data = await fs.readFile(modulePath)
        // Not sure why eslint ignores this definition from webassembly.d.ts,
        // but this doesn't work without the following disable
        // eslint-disable-next-line no-undef
        const wasmObj = await WebAssembly.instantiate(data, go.importObject)
        return wasmObj.module
      })()
    }

    // Not sure why eslint ignores this definition from webassembly.d.ts,
    // but this doesn't work without the following disable
    // eslint-disable-next-line no-undef
    return this.wasmModule.then(module => WebAssembly.instantiate(module, go.importObject))
  }

  async Parse(src: Buffer, filename: string): Promise<{ body: HCLBlock; errors: string[] }> {
    try {
      await new Promise<void>(async (resolve) => {
        // Setup arguments to parse function
        global.hclParserFunc = 'parse'
        global.hclParserArgs = {
          src,
          filename,
          callback: resolve,
        }

        // Call parse from go, this will eventually call resolve through the callback
        // We use await here so that the promise ctor will catch any errors that may arise from go
        await go.run(await this.wasmInstance)
      })

      // Return value should be populated by the above call
      return global.hclParserReturn as HclParseReturn
    } finally {
      // cleanup args and return values
      delete global.hclParserFunc
      delete global.hclParserArgs
      delete global.hclParserReturn
    }
  }

  async Dump(body: HCLBlock): Promise<Buffer> {
    try {
      await new Promise<void>(async (resolve) => {
        // Setup arguments to dump function
        global.hclParserFunc = 'dump'
        global.hclParserArgs = {
          body,
          callback: resolve,
        }
        // Call dump from go, this will eventually call resolve through the callback
        // We use await here so that the promise ctor will catch any errors that may arise from go
        await go.run(await this.wasmInstance)
      })

      // Return value should be populated by the above call
      return global.hclParserReturn as HclDumpReturn
    } finally {
      // cleanup args and return values
      delete global.hclParserFunc
      delete global.hclParserArgs
      delete global.hclParserReturn
    }
  }
}

export default new HCLParser()
