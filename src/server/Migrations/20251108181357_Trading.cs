using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class Trading : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Trades",
                columns: table => new
                {
                    ID = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    InitiatorID = table.Column<Guid>(type: "uuid", nullable: false),
                    ReceiverID = table.Column<Guid>(type: "uuid", nullable: false),
                    OfferingItemIDs = table.Column<string>(type: "jsonb", nullable: false),
                    SeekingItemIDs = table.Column<string>(type: "jsonb", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Trades", x => x.ID);
                    table.CheckConstraint("CK_Trade_DifferentUsers", "\"InitiatorID\" <> \"ReceiverID\"");
                    table.ForeignKey(
                        name: "FK_Trades_Users_InitiatorID",
                        column: x => x.InitiatorID,
                        principalTable: "Users",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Trades_Users_ReceiverID",
                        column: x => x.ReceiverID,
                        principalTable: "Users",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Trades_InitiatorID",
                table: "Trades",
                column: "InitiatorID");

            migrationBuilder.CreateIndex(
                name: "IX_Trades_ReceiverID",
                table: "Trades",
                column: "ReceiverID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Trades");
        }
    }
}
