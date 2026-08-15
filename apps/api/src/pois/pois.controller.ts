import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePoiDto } from './dto/create-poi.dto';
import { ListPoisDto } from './dto/list-pois.dto';
import { PoisService } from './pois.service';

@ApiTags('poi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('poi')
export class PoisController {
  constructor(private readonly poisService: PoisService) {}

  @Get()
  @ApiOperation({ summary: 'List points of interest (SWAP stations, garages, etc.)' })
  async listPois(@Query() query: ListPoisDto) {
    return this.poisService.listPois(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get POI details by ID' })
  async getPoi(@Param('id', ParseUUIDPipe) id: string) {
    return this.poisService.getPoi(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new point of interest' })
  async createPoi(@Body() dto: CreatePoiDto) {
    return this.poisService.createPoi(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a point of interest by ID' })
  async updatePoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePoiDto>,
  ) {
    return this.poisService.updatePoi(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a point of interest by ID' })
  async patchPoi(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePoiDto>,
  ) {
    return this.poisService.updatePoi(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a point of interest' })
  async deletePoi(@Param('id', ParseUUIDPipe) id: string) {
    return this.poisService.deletePoi(id);
  }
}
