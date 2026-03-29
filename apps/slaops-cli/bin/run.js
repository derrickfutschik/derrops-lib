#!/usr/bin/env node
'use strict'

// oclif v4 entry point (CommonJS)
const { run, handle, flush } = require('@oclif/core')

run(process.argv.slice(2), __dirname)
  .then(flush)
  .catch(handle)
