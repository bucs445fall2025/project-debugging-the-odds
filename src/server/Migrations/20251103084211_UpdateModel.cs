using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class UpdateModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CHECK_User_AuthenticationFields",
                table: "Users");

            migrationBuilder.AddCheckConstraint(
                name: "CHECK_User_AuthenticationFields",
                table: "Users",
                sql: " ( (\"PasswordHash\" IS NOT NULL AND \"PasswordSalt\" IS NOT NULL AND \"OAuthProvider\" IS NULL)\r\n                  OR\r\n                    (\"PasswordHash\" IS NULL AND \"PasswordSalt\" IS NULL AND \"OAuthProvider\" IS NOT NULL)\r\n                )");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CHECK_User_AuthenticationFields",
                table: "Users");

            migrationBuilder.AddCheckConstraint(
                name: "CHECK_User_AuthenticationFields",
                table: "Users",
                sql: " ( (\"PasswordHash\" IS NOT NULL AND \"PasswordSalt\" IS NOT NULL AND \"OAuthProvider\" IS NULL)\n                  OR\n                    (\"PasswordHash\" IS NULL AND \"PasswordSalt\" IS NULL AND \"OAuthProvider\" IS NOT NULL)\n                )");
        }
    }
}
