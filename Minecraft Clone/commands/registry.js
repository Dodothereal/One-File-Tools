export class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  register(name, usage, description, run) {
    this.commands.set(name, { usage, description, run });
  }

  execute(input, context) {
    const [name, ...args] = input.trim().replace(/^\//, '').split(/\s+/);
    const command = this.commands.get(name.toLowerCase());
    if (!command) return `Unknown command: /${name}. Try /help.`;
    return command.run(args, context) ?? '';
  }
}
