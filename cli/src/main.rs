mod api;
mod commands;
mod config;
mod crypto;

use anyhow::Result;
use clap::{Parser, Subcommand};
use colored::Colorize;

#[derive(Parser)]
#[command(
    name = "void",
    about = "VOID — Vault-Oriented Infrastructure for Developers",
    version = "1.0.0"
)]
struct Cli {
    /// Override API endpoint (e.g. https://void.moonsh.dev)
    #[arg(long, global = true)]
    endpoint: Option<String>,

    /// Path to a CLI conf JSON file with an "endpoint" field
    #[arg(long, global = true)]
    conf: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Authenticate with the VOID server
    Auth {
        #[arg(long)]
        username: Option<String>,
        #[arg(long)]
        password: Option<String>,
    },
    /// Log out
    Logout,
    /// Show current user info
    Whoami,
    /// Initialize .void.json in current directory
    Init,
    /// Manage teams
    Teams {
        #[command(subcommand)]
        action: TeamsAction,
    },
    /// Manage apps
    Apps {
        #[command(subcommand)]
        action: AppsAction,
    },
    /// Manage environments
    Envs {
        #[command(subcommand)]
        action: EnvsAction,
    },
    /// Manage secrets
    Secrets {
        #[command(subcommand)]
        action: SecretsAction,
    },
    /// Run a command with secrets injected as environment variables
    Run {
        #[arg(long)]
        app: Option<String>,
        #[arg(long)]
        env: Option<String>,
        /// Command and arguments (after --)
        #[arg(last = true)]
        command: Vec<String>,
    },
    /// Spawn a shell with secrets as environment variables
    Shell {
        #[arg(long)]
        app: Option<String>,
        #[arg(long)]
        env: Option<String>,
        /// Use bash explicitly
        #[arg(long)]
        bash: bool,
    },
    /// Open web console in default browser
    Console,
    /// Open documentation in default browser
    Docs,
}

#[derive(Subcommand)]
enum TeamsAction {
    /// List all teams
    List,
}

#[derive(Subcommand)]
enum AppsAction {
    /// List all apps
    List,
}

#[derive(Subcommand)]
enum EnvsAction {
    /// List environments for an app
    List {
        #[arg(long)]
        app: Option<String>,
    },
}

#[derive(Subcommand)]
enum SecretsAction {
    /// List secret keys (values hidden)
    List {
        #[arg(long)]
        app: Option<String>,
        #[arg(long)]
        env: Option<String>,
        #[arg(long)]
        keys_only: bool,
    },
    /// Decrypt and print a secret value
    Get {
        key: String,
        #[arg(long)]
        app: Option<String>,
        #[arg(long)]
        env: Option<String>,
        #[arg(long)]
        json: bool,
    },
    /// Create a new secret
    Create {
        #[arg(long)]
        key: String,
        #[arg(long)]
        value: String,
        #[arg(long)]
        app: Option<String>,
        #[arg(long)]
        env: Option<String>,
    },
    /// Delete a secret
    Delete {
        #[arg(long)]
        key: String,
        #[arg(long)]
        app: Option<String>,
        #[arg(long)]
        env: Option<String>,
        #[arg(long)]
        force: bool,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Resolve API endpoint before running any command
    let host = match config::endpoint::resolve(cli.endpoint, cli.conf).await {
        Ok(h) => h,
        Err(e) => {
            eprintln!("{} {}", "error:".red(), e);
            std::process::exit(1);
        }
    };

    // Inject resolved host into global config for this session
    let mut global_cfg = config::global::load().unwrap_or_default();
    global_cfg.auth.api_host = Some(host.clone());

    let result = match cli.command {
        Commands::Auth { username, password } => {
            config::global::save(&global_cfg)?;
            commands::auth::run_auth(username, password).await
        }
        Commands::Logout => commands::auth::run_logout().await,
        Commands::Whoami => commands::auth::run_whoami().await,
        Commands::Init => commands::init::run_init().await,

        Commands::Teams { action } => match action {
            TeamsAction::List => commands::teams::list().await,
        },
        Commands::Apps { action } => match action {
            AppsAction::List => commands::apps::list().await,
        },
        Commands::Envs { action } => match action {
            EnvsAction::List { app } => commands::envs::list(app).await,
        },

        Commands::Secrets { action } => match action {
            SecretsAction::List { app, env, keys_only } => {
                commands::secrets::list(app, env, keys_only).await
            }
            SecretsAction::Get { key, app, env, json: _ } => {
                commands::secrets::get(app, env, key).await
            }
            SecretsAction::Create { key, value, app, env } => {
                commands::secrets::create(app, env, key, value).await
            }
            SecretsAction::Delete { key, app, env, force } => {
                commands::secrets::delete(app, env, key, force).await
            }
        },

        Commands::Run { app, env, command } => commands::run::run_exec(app, env, command).await,
        Commands::Shell { app, env, bash } => commands::shell::run_shell(app, env, bash).await,

        Commands::Console => {
            if let Err(e) = open::that(&host) {
                eprintln!("open browser: {}", e);
            }
            Ok(())
        }
        Commands::Docs => {
            let _ = open::that("https://github.com/void-project/void");
            Ok(())
        }
    };

    if let Err(e) = result {
        eprintln!("{} {}", "error:".red(), e);
        std::process::exit(1);
    }

    Ok(())
}
