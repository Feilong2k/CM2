// orion-cli.spec.js
// Unit tests for CLI Interface class in bin/orion-cli.js

const stream = require('stream');
const EventEmitter = require('events');

jest.mock('../../backend/src/agents/OrionAgent.js', () => {
  return jest.fn().mockImplementation(() => ({
    processTaskStreaming: jest.fn(async function* (input) {
      yield { type: 'chunk', content: `Echo: ${input}` };
      yield { type: 'final', content: 'Done' };
    })
  }));
});

const OrionAgent = require('../../backend/src/agents/OrionAgent.js');

describe('CLI Interface', () => {
  let inputStream;
  let outputStream;
  let cliInstance;
  let readlineInterfaceMock;
  let InterfaceClass;

  beforeEach(() => {
    jest.resetModules();

    // Mock input/output streams
    inputStream = new stream.PassThrough();
    outputStream = new stream.PassThrough();
    outputStream.write = jest.fn();

    // Mock readline interface
    readlineInterfaceMock = new EventEmitter();
    readlineInterfaceMock.close = jest.fn();

    // Mock readline.createInterface to return our mock interface
    jest.mock('readline', () => ({
      createInterface: jest.fn(() => readlineInterfaceMock)
    }));

    // Import the CLI module after mocking readline
    InterfaceClass = require('../../bin/orion-cli.js').Interface;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should instantiate with custom input/output streams and load .env', () => {
    const cli = new InterfaceClass({ input: inputStream, output: outputStream });
    expect(cli.input).toBe(inputStream);
    expect(cli.output).toBe(outputStream);
    expect(OrionAgent).toHaveBeenCalled();
  });

  it('should call processTaskStreaming on user input and write output', async () => {
    const cli = new InterfaceClass({ input: inputStream, output: outputStream });
    cli.readline = readlineInterfaceMock;

    // Simulate user input line
    const userInput = 'Hello CLI';
    const processSpy = jest.spyOn(cli.agent, 'processTaskStreaming');

    // Start listening for input
    cli._handleLine(userInput);

    // Wait for async generator to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(processSpy).toHaveBeenCalledWith(userInput);
    expect(outputStream.write).toHaveBeenCalledWith(expect.stringContaining('Echo: Hello CLI'));
  });

  it('should close readline and emit exit on "exit" or "quit"', () => {
    const cli = new InterfaceClass({ input: inputStream, output: outputStream });
    cli.readline = readlineInterfaceMock;
    const exitSpy = jest.fn();
    cli.on('exit', exitSpy);

    cli._handleLine('exit');
    expect(readlineInterfaceMock.close).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalled();

    cli._handleLine('quit');
    expect(readlineInterfaceMock.close).toHaveBeenCalledTimes(2);
    expect(exitSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle errors from processTaskStreaming and re-prompt', async () => {
    const cli = new InterfaceClass({ input: inputStream, output: outputStream });
    cli.readline = readlineInterfaceMock;

    // Mock processTaskStreaming to throw
    cli.agent.processTaskStreaming = jest.fn(() => {
      throw new Error('Test error');
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    cli._handleLine('trigger error');

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    expect(outputStream.write).toHaveBeenCalledWith(expect.stringContaining('Error'));
    errorSpy.mockRestore();
  });
});
