export class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  register(name, usage, description, run, complete = () => []) {
    this.commands.set(name, { usage, description, run, complete });
  }

  complete(input) {
    const [name, ...args] = input.trimStart().replace(/^\//, '').split(/\s+/);
    if (!args.length) return [...this.commands.keys()].filter(key => key.startsWith(name.toLowerCase())).map(key => '/' + key);
    const command = this.commands.get(name.toLowerCase());
    if (!command) return [];
    const prefix = args.at(-1).toLowerCase();
    const previous = args.slice(0, -1);
    return command.complete(previous).filter(value => value.toLowerCase().startsWith(prefix))
      .map(value => '/' + [name.toLowerCase(), ...previous, value].join(' '));
  }

  execute(input, context) {
    const [name, ...args] = input.trim().replace(/^\//, '').split(/\s+/);
    const command = this.commands.get(name.toLowerCase());
    if (!command) return `Unknown command: /${name}. Try /help.`;
    try { return command.run(args, context) ?? ''; }
    catch (error) {
      if (error instanceof SyntaxError) return `${error.message}\nUsage: ${command.usage}`;
      throw error;
    }
  }
}
