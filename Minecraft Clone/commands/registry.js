export class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  register(name, usage, description, run) {
    this.commands.set(name, { usage, description, run });
  }

  complete(input) {
    const prefix = input.trim().replace(/^\//, '').toLowerCase();
    if (/\s/.test(prefix)) return [];
    return [...this.commands.keys()].filter(name => name.startsWith(prefix)).map(name => '/' + name);
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
